# Training workspace

This folder holds the small, reproducible parts of the YOLO26s training: the Colab notebook and the recorded results of the run in use. **Datasets and weights are not committed** (too large for Git and not source code).

| Path | In Git | Contents |
| --- | :-: | --- |
| `notebooks/rubikvision.ipynb` | yes | Colab notebook (T4 GPU): dataset prep, training with checkpoints synced to Drive, validation and test evaluation. Colab account metadata was removed. |
| `runs/yolo26s_rubik_v2/` | yes (no weights) | `results.csv` (per-epoch metrics), `args.yaml` (exact training arguments), the training charts, `evaluation/val` and `evaluation/test` (metrics, curves, confusion matrices, sample predictions). |
| `datasets/` | no | Dataset zips and extracted images (ignored). |
| `runs/**/weights/`, `exports/` | no | `last.pt`, `best.pt` (about 96 MB each with optimizer state) and the exported checkpoint (ignored). |

## Reproduce the run

1. **Dataset.** Export [`rubik-2mkm7` v3](https://universe.roboflow.com/quang-phuc-ngo/rubik-2mkm7) from Roboflow in YOLO format (CC BY 4.0), or build your own. `data.yaml` must list the classes exactly as `['blue', 'green', 'orange', 'red', 'white', 'yellow']`. Zip it with `train/`, `valid/`, `test/` and `data.yaml` at the top level and upload it to `MyDrive/RubikVision/datasets/rubik_color.zip`.
2. **Train.** Open `notebooks/rubikvision.ipynb` in Colab with a T4 runtime and run the cells top to bottom. Set `MODE = 'train'` and a new `RUN_NAME` (for example `yolo26s_rubik_v3`) in the configuration cell. The notebook's `TRAIN_CONFIG` matches the one documented in the [root README](../README.md#training-guide); `runs/yolo26s_rubik_v2/args.yaml` records the values used for the reported run.
3. **Deploy.** Copy the exported `best_final.pt` to `backend/weights/best.pt`, run `uv run pytest -m model` from `backend/`, then restart the backend.

## Reported run (`yolo26s_rubik_v2`)

| Split | mAP50 | mAP50-95 |
| --- | ---: | ---: |
| Validation | 0.978 | 0.754 |
| Test | 0.984 | 0.761 |

94 of 150 epochs (early stopping, patience 30, best epoch 64), batch 32, 640 px, Ultralytics 8.4.216. These are dataset metrics and do not replace testing with a real webcam. The charts are in the root README.

## Sharing weights

Do not commit `.pt` files. Attach `best.pt` (about 20 MB) to a GitHub release, or use Git LFS, and note its SHA-256 (the first 12 hex characters are shown by `/health` as part of `modelVersion`).
