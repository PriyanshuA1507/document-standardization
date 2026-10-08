# Model weights

The pipeline runs entirely on one local model, **NVIDIA Qwen3-VL 4B Instruct AWQ**, for both passes. No
inference API is ever called.

The weights themselves are **not stored in this repository**. They total about 66 GB in files of up to
4 GB, well beyond what Git or GitHub can hold. Instead, [`manifest.json`](manifest.json) pins the model
to an exact revision and lists every file with its size and checksum. The weights are staged once from
a connected machine and verified on the air-gapped system.

| Key | Model | Revision | Size | Licence |
| --- | --- | --- | --- | --- |
| `qwen3-vl-4b-instruct-awq` | [Qwen/Qwen3-VL-4B-Instruct-AWQ](https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct-AWQ) | `e5e9932` | 66.1 GB (50 files) | NVIDIA Open Model Agreement |

## Staging for an air-gapped site

1. On a machine with internet access:

   ```bash
   pip install -r requirements.txt
   python -m report_to_json.download --model qwen3-vl-4b-instruct-awq --dest /transfer/models
   ```

   The download is pinned to the manifest's revision and checked against it before the command
   reports success.

2. Carry `/transfer/models/Qwen3-VL-4B-Instruct-AWQ-4bit` across, and place it in this
   `models/` folder (or under `MODELS_DIR`).

3. On the air-gapped system, confirm the copy is complete and intact:

   ```bash
   python -m report_to_json.download --verify qwen3-vl-4b-instruct-awq
   ```

4. Serve it locally (recommended, see [docs/models.md](../docs/models.md)):

   ```bash
   vllm serve models/Qwen3-VL-4B-Instruct-AWQ-4bit \
        --served-model-name Qwen/Qwen3-VL-4B-Instruct-AWQ \
        --trust-remote-code --enable-prefix-caching
   ```

   Alternatively, leave it in `models/` and the app loads it in-process.

To move to a newer revision, run `python -m report_to_json.download --refresh-manifest` on a connected
machine, review the diff of `manifest.json`, and commit it.

## Licence

The model is released under the NVIDIA Open Model Agreement, which governs its use and any internal
redistribution of the weights. Read the full terms on the model's page before deploying, and keep the
licence and notice files that ship with the weights.

The weights folder placed here is git-ignored; only this README and `manifest.json` are tracked.
