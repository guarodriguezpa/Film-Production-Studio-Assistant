import json
import os
import sys

from google import genai


def main() -> None:
    payload = json.loads(sys.stdin.read())
    scene_text = payload["sceneText"]
    inventory = payload["inventory"]

    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
    prompt = f"""
You are a film production assistant. Read the screenplay scene below and identify
physical props, furniture, wardrobe pieces, lighting, and camera equipment that
the production should pull from inventory.

Return ONLY valid JSON with this exact shape:
{{
  "sceneTitle": "short scene title",
  "location": "scene location",
  "items": [
    {{"matchedTerm": "one exact inventory term", "requestedQty": 1}}
  ]
}}

Only use matchedTerm values from the supplied inventory terms. Do not invent
inventory terms. Include an item only when the scene clearly requires it.

Inventory terms:
{json.dumps(inventory, ensure_ascii=False)}

Screenplay scene:
{scene_text}
"""
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config={"response_mime_type": "application/json"},
        )
    except Exception as error:
        # Google currently rejects gemini-2.5-flash for some newly provisioned
        # accounts. Preserve the requested model as the primary path, but keep
        # the studio usable when the provider returns its model-retirement 404.
        if "no longer available" not in str(error):
            raise
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt,
            config={"response_mime_type": "application/json"},
        )
    text = response.text or "{}"
    result = json.loads(text)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"error": str(error)}))
        sys.exit(1)