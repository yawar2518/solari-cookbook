import anthropic
import json
import os
from dotenv import load_dotenv

load_dotenv()

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

PARSE_SYSTEM_PROMPT = """You are an expert career advisor helping students and early-career professionals find the right opportunities.

Your job is to read a user's free-text description of themselves and extract a structured profile — then infer what roles they would likely be a good fit for, even if they haven't named any.

Return ONLY a valid JSON object with this exact structure:

{
  "education": {
    "level": "string (e.g. undergraduate, graduate, bootcamp, self-taught)",
    "field": "string or null",
    "year": "string or null (e.g. 2nd year, 4th semester, final year)",
    "institution": "string or null"
  },
  "skills": {
    "confirmed": ["skills explicitly mentioned"],
    "inferred": ["skills reasonably inferred from courses or projects"]
  },
  "experience": {
    "level": "string: one of [no experience, beginner, some experience, intermediate]",
    "highlights": ["any projects, internships, freelance work mentioned"]
  },
  "preferences": {
    "job_type": "string or null: one of [internship, full-time, part-time, any]",
    "location_type": "string or null: one of [remote, onsite, hybrid, any]",
    "location_scope": "string or null: one of [local, national, global]",
    "city": "string or null — specific city if mentioned",
    "country": "string or null — specific country if mentioned",
    "availability": "string or null"
  },
  "inferred_roles": [
    {
      "role": "string (e.g. Backend Developer Intern, Data Analyst)",
      "confidence": "string: one of [high, medium, low]",
      "reasoning": "one short sentence explaining why this role fits"
    }
  ],
  "search_keywords": {
    "global": ["3-6 specific keywords for LinkedIn and Indeed"],
    "local": ["2-4 simplified keywords for local platforms like Internshala, Rozee"]
  },
  "summary": "2-3 sentence human-readable summary of this person"
}

Rules:
- inferred_roles must have at least 2 and at most 5 roles
- search_keywords.global should be specific (e.g. 'Python backend intern remote' not just 'Python')
- search_keywords.local should be simpler and broader (e.g. 'Python intern', 'AI intern', 'backend intern')
- if user says 'Pakistan only' → location_scope: national, country: Pakistan
- if user says 'Lahore' → city: Lahore, country: Pakistan, location_scope: local
- if user says 'remote only' → location_type: remote, location_scope: global
- if user says nothing about location → all location fields null, location_type: any
- be generous with inferred skills — databases course means SQL, OOP means Java or Python OOP
- return only the JSON, no preamble, no markdown fences"""


def parse_user_context(user_text: str) -> dict:
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        system=PARSE_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"Here is my background:\n\n{user_text}"
            }
        ]
    )

    raw = message.content[0].text.strip()

    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    return json.loads(raw)


if __name__ == "__main__":
    test_input = """
    I'm in my 7th semester of Software Engineering. I know Python well, 
    have built n8n automations, worked with the Claude API, and done some 
    freelancing on Upwork. I've built LLM pipelines and AI automation tools. 
    Not sure exactly what role I want but open to anything AI or backend related.
    I'm based in Lahore, open to remote globally or onsite in Pakistan.
    """

    print("Testing context parser...\n")
    result = parse_user_context(test_input)
    print(json.dumps(result, indent=2))