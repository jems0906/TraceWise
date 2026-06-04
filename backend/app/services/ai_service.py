import json
import os
from typing import Any, Dict, List

from openai import OpenAI


class AIService:
    def __init__(self) -> None:
        self.api_key = os.getenv("OPENAI_API_KEY", "")
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.allow_fallback = os.getenv("ALLOW_FALLBACK_AI", "true").lower() == "true"
        self.client = OpenAI(api_key=self.api_key) if self.api_key else None

    def _fallback_parse(self, raw_input: str) -> Dict[str, str]:
        trimmed = " ".join(raw_input.split())
        title = trimmed[:80] + ("..." if len(trimmed) > 80 else "")
        return {
            "title": title,
            "business_requirement": f"Business needs: {trimmed}",
            "functional_requirement": "System should support the described business need with measurable outcomes.",
            "non_functional_requirement": "System should be secure, auditable, and performant for enterprise usage.",
            "user_story": f"As a business analyst, I want to capture and track '{title}' so that delivery teams can execute clearly.",
            "impact": "Medium",
        }

    def parse_requirement(self, raw_input: str) -> Dict[str, str]:
        if not self.client:
            return self._fallback_parse(raw_input)

        prompt = (
            "Convert the raw business need into JSON with keys: "
            "title, business_requirement, functional_requirement, non_functional_requirement, user_story, impact. "
            "Use concise enterprise language."
        )

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a senior business analyst assistant."},
                    {"role": "user", "content": f"{prompt}\n\nRaw need:\n{raw_input}"},
                ],
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content or "{}"
            data = json.loads(content)
            return {
                "title": data.get("title", "Untitled Requirement"),
                "business_requirement": data.get("business_requirement", ""),
                "functional_requirement": data.get("functional_requirement", ""),
                "non_functional_requirement": data.get("non_functional_requirement", ""),
                "user_story": data.get("user_story", ""),
                "impact": data.get("impact", "Medium"),
            }
        except Exception:
            if self.allow_fallback:
                return self._fallback_parse(raw_input)
            raise

    def clarify_requirement(self, raw_input: str) -> Dict[str, List[str]]:
        lower = raw_input.lower()
        missing = []
        questions = []
        ambiguity = []
        risks = []

        if "quickly" in lower or "soon" in lower:
            ambiguity.append("Timeline is vague.")
            questions.append("What is the exact target delivery date?")
        if "better" in lower or "improve" in lower:
            ambiguity.append("Success criteria are not measurable.")
            questions.append("What KPI defines success for this requirement?")
        if "secure" not in lower:
            missing.append("Security expectations")
            questions.append("Are there security or compliance requirements?")
            risks.append("Potential compliance gap")
        if "integrat" not in lower:
            missing.append("Integration dependencies")
            questions.append("Which source systems or APIs are involved?")
            risks.append("Integration unknowns may delay implementation")

        if not questions:
            questions.append("Can you confirm acceptance criteria in Given/When/Then format?")

        return {
            "missing_information": missing,
            "clarification_questions": questions,
            "ambiguity_flags": ambiguity,
            "potential_risks": risks,
        }


ai_service = AIService()
