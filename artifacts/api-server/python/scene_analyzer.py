import asyncio
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from main import analyze_scene


def main() -> None:
    payload = json.loads(sys.stdin.read())
    result = asyncio.run(analyze_scene(payload["sceneText"], payload["inventory"]))
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"error": str(error)}))
        sys.exit(1)