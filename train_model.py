#!/usr/bin/env python3
"""Train + quantize the client-side intent classifier for anymodel.

Run once locally (NOT on GitHub Pages) to produce `intent_model.ftz`,
which ships as a static file next to the site. Classification then runs
entirely in the browser via the fastText WebAssembly build.

    python3 train_model.py

Requires: pip install fasttext-wheel  (prebuilt wheels; pin numpy<2)

The dataset `intent_train.txt` contains the four intents the router
understands — chat, tts, image, transcription — with English, Spanish
and Japanese examples, plus deliberate typos so the subword model is
robust to misspellings.
"""

import os
import sys

import fasttext

TRAIN_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "intent_train.txt")
MODEL_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "intent_model.ftz")

# The self-test cases that run automatically in the browser (see
# js/intent-router.js). Used here to gate the training output.
SELF_TESTS = [
    ("make this talk",         "tts",           0.80),
    ("crea una imagen",        "image",         0.70),
    ("explain physics",        "chat",          0.80),
    ("genrate audo",           "tts",           0.65),  # typo tolerance via subwords
    ("transcribe this audio",  "transcription", 0.65),
    ("generate speech of this text", "tts",     0.65),  # low-threshold phrasing
    ("summarize this text",    "chat",          0.65),  # must NOT drift to image
]


def main():
    if not os.path.exists(TRAIN_FILE):
        sys.exit(f"Training file not found: {TRAIN_FILE}")

    # Hyperparameters tuned for a small intent router:
    #  - wordNgrams=2 lets "make this talk" read as a phrase, not 3 words
    #  - minn/maxn character n-grams give typo tolerance
    #  - dim=50 keeps the embedding matrix small before quantization
    model = fasttext.train_supervised(
        input=TRAIN_FILE,
        lr=0.5,
        epoch=100,
        wordNgrams=2,
        dim=50,
        loss="softmax",
        minn=3,
        maxn=6,
        bucket=40000,
        seed=1,
        verbose=2,
    )

    # Quantize: compresses the model ~10x with minimal accuracy loss.
    # `retrain` re-runs the loss optimization against the quantized
    # input matrix, which recovers most of the accuracy.
    model.quantize(input=TRAIN_FILE, retrain=True, qnorm=True, cutoff=0, dsub=2)

    model.save_model(MODEL_FILE)
    size_kb = os.path.getsize(MODEL_FILE) / 1024
    print(f"\nModel saved: {MODEL_FILE}  ({size_kb:.0f} KB)")

    # Gate on the same self-tests the browser runs on load.
    failed = 0
    print("\nSelf-test results (text -> expected intent, min confidence):")
    for text, expected, min_conf in SELF_TESTS:
        labels, probs = model.predict(text, k=1)
        got = labels[0].replace("__label__", "")
        conf = probs[0]
        ok = got == expected and conf >= min_conf
        failed += 0 if ok else 1
        status = "PASS" if ok else "FAIL"
        print(f"  [{status}] {text!r:32} -> {got:14} conf={conf:.3f} (need {expected} >= {min_conf})")

    if failed:
        print(f"\n{failed} self-test(s) failed — tune intent_train.txt and retrain.")
        sys.exit(1)

    print("\nAll self-tests passed. Commit intent_model.ftz and deploy to GitHub Pages.")


if __name__ == "__main__":
    main()
