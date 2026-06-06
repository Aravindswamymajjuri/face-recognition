# save as: backend/download_models.py
from huggingface_hub import hf_hub_download

REPO_ID = "biometric-ai-lab/Face_Recognition"

print("📥 Downloading pytorch_model.bin (~529MB)...")
recog_path = hf_hub_download(repo_id=REPO_ID, filename="pytorch_model.bin")
print(f"✅ Saved to: {recog_path}")

print("📥 Downloading yolov8s-face-lindevs.onnx (~45MB)...")
yolo_path = hf_hub_download(repo_id=REPO_ID, filename="yolov8s-face-lindevs.onnx")
print(f"✅ Saved to: {yolo_path}")

print("🎉 Both models ready!")