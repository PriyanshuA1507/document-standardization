import os
import sys

# Set HF_HOME so models are explicitly cached in the app directory for easier tracking (optional)
# os.environ["HF_HOME"] = "/app/models"

def download_models():
    print("Downloading HuggingFace models for offline use...")
    
    try:
        from transformers import pipeline
        
        # Zero-shot classification model
        model_name = "facebook/bart-large-mnli"
        
        print(f"Loading {model_name}...")
        # Instantiating the pipeline will download the model weights and cache them
        pipe = pipeline("zero-shot-classification", model=model_name)
        
        print(f"  {model_name} loaded successfully.")
        
        # Sentence-BERT model for semantic clustering
        sbert_model_name = "sentence-transformers/all-mpnet-base-v2"
        print(f"Loading {sbert_model_name}...")
        from sentence_transformers import SentenceTransformer
        SentenceTransformer("all-mpnet-base-v2")
        print(f"  {sbert_model_name} loaded successfully.")
        
        # TimesFM-3 Zero-Shot Foundation Model for Multivariate Time-Series Forecasting
        print("Checking TimesFM-3 Foundation Model...")
        try:
            from timesfm import TimesFM3Forecaster
            print("  TimesFM-3 library ready. Pre-caching checkpoint if accessible...")
            TimesFM3Forecaster.from_pretrained("google/timesfm-3.0-pytorch")
            print("  TimesFM-3 weights cached successfully.")
        except Exception as e_tfm:
            print(f"  Notice: TimesFM-3 weights download deferred or requires token: {e_tfm}")
        
        print("Download complete. All models are cached locally.")
        
    except Exception as e:
        print(f"Error downloading models: {e}")
        sys.exit(1)

if __name__ == "__main__":
    download_models()
