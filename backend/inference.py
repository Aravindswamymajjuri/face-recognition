import os
import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import transforms
import torchvision.models as models
from PIL import Image
import onnxruntime as ort
from huggingface_hub import hf_hub_download

# ==========================================
# REPO CONFIG
# ==========================================
REPO_ID = "biometric-ai-lab/Face_Recognition"
RECOG_FILENAME = "pytorch_model.bin"
YOLO_FILENAME = "yolov8s-face-lindevs.onnx"


# ==========================================
# 1. MODEL ARCHITECTURE
# ==========================================
class FaceRecognitionModel(nn.Module):
    def __init__(self):
        super(FaceRecognitionModel, self).__init__()
        self.backbone = models.wide_resnet101_2(weights=None)
        self.backbone.fc = nn.Identity()
        self.embed = nn.Sequential(
            nn.Linear(2048, 512),
            nn.BatchNorm1d(512),
            nn.ReLU(inplace=True),
        )

    def forward(self, img):
        features = self.backbone(img)
        embedding = self.embed(features)
        return F.normalize(embedding, p=2, dim=1)


# ==========================================
# 2. YOLO FACE DETECTOR
# ==========================================
class YOLOFaceDetector:
    def __init__(self, model_path, conf_threshold=0.5):
        # Force CPU only — prevents cublasLt64_12.dll CUDA crash on Windows
        providers = ['CPUExecutionProvider']
        self.session = ort.InferenceSession(model_path, providers=providers)
        self.input_name = self.session.get_inputs()[0].name
        self.output_names = [output.name for output in self.session.get_outputs()]
        self.conf_threshold = conf_threshold
        self.input_size = 640

    def detect_extract_face(self, image_pil, expand_ratio=0.0):
        image_np = np.array(image_pil)
        image_bgr = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
        img_height, img_width = image_bgr.shape[:2]

        img_resized = cv2.resize(image_bgr, (self.input_size, self.input_size))
        img_rgb = cv2.cvtColor(img_resized, cv2.COLOR_BGR2RGB)
        img_normalized = img_rgb.astype(np.float32) / 255.0
        img_transposed = np.transpose(img_normalized, (2, 0, 1))
        img_batch = np.expand_dims(img_transposed, axis=0)

        outputs = self.session.run(self.output_names, {self.input_name: img_batch})
        predictions = outputs[0]

        if len(predictions.shape) == 3:
            predictions = predictions[0].T

        best_face = None
        max_area = 0

        for pred in predictions:
            conf = pred[4]
            if conf > self.conf_threshold:
                x_center, y_center, w, h = pred[:4]

                x_center = x_center * img_width / self.input_size
                y_center = y_center * img_height / self.input_size
                w = w * img_width / self.input_size
                h = h * img_height / self.input_size

                x1 = max(0, int(x_center - w / 2))
                y1 = max(0, int(y_center - h / 2))
                x2 = min(img_width, int(x_center + w / 2))
                y2 = min(img_height, int(y_center + h / 2))

                area = (x2 - x1) * (y2 - y1)
                if area > max_area:
                    max_area = area
                    best_face = (x1, y1, x2, y2)

        if best_face:
            x1, y1, x2, y2 = best_face
            if expand_ratio != 0:
                w_box = x2 - x1
                h_box = y2 - y1
                pad = int(expand_ratio * max(w_box, h_box))
                x1 = max(0, x1 - pad)
                y1 = max(0, y1 - pad)
                x2 = min(img_width, x2 + pad)
                y2 = min(img_height, y2 + pad)
            return image_pil.crop((x1, y1, x2, y2))

        raise ValueError(
            "No face detected. Please center your face in the frame and improve lighting."
        )


# ==========================================
# 3. FACE ANALYSIS WRAPPER
# ==========================================
class FaceAnalysis:
    def __init__(self, device=None):
        use_gpu = os.getenv('USE_GPU', '').lower() in {'1', 'true', 'yes'}
        self.device = device if device else ('cuda' if use_gpu and torch.cuda.is_available() else 'cpu')
        print(f"🚀 Initializing Face Analysis on {self.device}...")

        # 1. Download models
        try:
            print(f"📥 Checking models from {REPO_ID}...")
            recog_path = hf_hub_download(repo_id=REPO_ID, filename=RECOG_FILENAME)
            yolo_path = hf_hub_download(repo_id=REPO_ID, filename=YOLO_FILENAME)
        except Exception as e:
            raise RuntimeError(f"❌ Failed to download models.\nError: {e}")

        # 2. Init YOLO detector
        self.yolo = YOLOFaceDetector(yolo_path, conf_threshold=0.5)

        # 3. Init recognition model
        self.model = FaceRecognitionModel().to(self.device)

        # ✅ FIXED: correctly handles model_state_dict and all checkpoint formats
        checkpoint = torch.load(recog_path, map_location=self.device, weights_only=False)

        # Show top-level keys for debugging
        top_keys = list(checkpoint.keys()) if isinstance(checkpoint, dict) else 'raw'
        print(f"🔑 Checkpoint top-level keys: {top_keys}")

        # Extract the actual weights from whichever key holds them
        if isinstance(checkpoint, dict):
            if 'model_state_dict' in checkpoint:
                state_dict = checkpoint['model_state_dict']   # ✅ YOUR CASE
                print("📦 Extracted from 'model_state_dict'")
            elif 'model' in checkpoint:
                state_dict = checkpoint['model']
                print("📦 Extracted from 'model'")
            elif 'state_dict' in checkpoint:
                state_dict = checkpoint['state_dict']
                print("📦 Extracted from 'state_dict'")
            else:
                state_dict = checkpoint
                print("📦 Using raw checkpoint as state_dict")
        else:
            state_dict = checkpoint
            print("📦 Using raw checkpoint")

        print(f"📊 Total keys in state_dict: {len(state_dict)}")

        # Inspect first key to detect backbone prefix mismatch
        sample_key = next(iter(state_dict.keys()))
        print(f"🔑 First weight key: '{sample_key}'")

        # Remap keys if backbone. prefix is missing
        if not sample_key.startswith('backbone.') and not sample_key.startswith('embed.'):
            fixed_state_dict = {}
            for k, v in state_dict.items():
                if (
                    k.startswith('layer')
                    or k.startswith('conv')
                    or k.startswith('bn')
                    or k.startswith('fc.')
                    or k.startswith('downsample')
                ):
                    fixed_state_dict[f'backbone.{k}'] = v
                else:
                    fixed_state_dict[k] = v
            state_dict = fixed_state_dict
            print(f"🔧 Remapped keys with 'backbone.' prefix. Total: {len(state_dict)}")

        # Load — strict=False tolerates minor mismatches
        missing, unexpected = self.model.load_state_dict(state_dict, strict=False)
        print(f"✅ Model loaded — Missing: {len(missing)}, Unexpected: {len(unexpected)}")
        if missing:
            print(f"   Missing sample (first 3): {missing[:3]}")
        if unexpected:
            print(f"   Unexpected sample (first 3): {unexpected[:3]}")

        self.model.eval()

        # 4. Image transform — must match training preprocessing exactly
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225],
            ),
        ])
        print("✅ System Ready!")

    def process_image(self, image_source, expand_ratio=0.0):
        if isinstance(image_source, str):
            if not os.path.exists(image_source):
                raise FileNotFoundError(f"Image not found: {image_source}")
            img_pil = Image.open(image_source).convert('RGB')
        elif isinstance(image_source, Image.Image):
            img_pil = image_source.convert('RGB')
        elif isinstance(image_source, np.ndarray):
            img_pil = Image.fromarray(cv2.cvtColor(image_source, cv2.COLOR_BGR2RGB))
        else:
            raise ValueError("Input must be a filepath, PIL Image, or numpy array")

        # Detect & crop — raises ValueError if no face found
        face_crop = self.yolo.detect_extract_face(img_pil, expand_ratio=expand_ratio)

        img_tensor = self.transform(face_crop).unsqueeze(0).to(self.device)
        with torch.no_grad():
            embedding = self.model(img_tensor)

        return embedding

    def compare(self, img1, img2, threshold=0.45, expand_ratio=0.01):
        emb1 = self.process_image(img1, expand_ratio)
        emb2 = self.process_image(img2, expand_ratio)
        similarity = F.cosine_similarity(emb1, emb2).item()
        return similarity, similarity > threshold