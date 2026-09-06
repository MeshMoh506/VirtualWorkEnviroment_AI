"""
Tool schemas the agents call through (Anthropic tool-use format:
name + description + JSON-schema input_schema). Kept separate from the
agent modules so the shape of each tool is easy to find and review in one
place — it's effectively the contract each agent's LLM calls have to fill.
"""

CREATE_TASK_TOOL = {
    "name": "create_task",
    "description": (
        "Assign a new task to the graduate on the task board. Use this to "
        "hand out exactly one clear, scoped, testable deliverable."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "title": {
                "type": "string",
                "description": "Short task title, shown on the kanban card.",
            },
            "description": {
                "type": "string",
                "description": (
                    "Full task brief: what to build, any constraints, and "
                    "what 'done' looks like."
                ),
            },
        },
        "required": ["title", "description"],
    },
}

POST_MESSAGE_TOOL = {
    "name": "post_message",
    "description": "Post a plain-text message in the task's comment thread.",
    "input_schema": {
        "type": "object",
        "properties": {
            "content": {"type": "string", "description": "The message to post."},
        },
        "required": ["content"],
    },
}

# Rubric keys match frontend/src/lib/reviews.ts's proposed shape exactly —
# see docs/PROJECT_STATUS.md: that shape was flagged as "not an agreed
# contract yet". This is that contract's first real implementation.
SUBMIT_REVIEW_TOOL = {
    "name": "submit_review",
    "description": "Submit a structured code review for a submitted task.",
    "input_schema": {
        "type": "object",
        "properties": {
            "verdict": {
                "type": "string",
                "enum": ["approved", "needs_changes"],
                "description": (
                    "'needs_changes' only when something genuinely blocks "
                    "the task's goal — minor gaps can still be 'approved'."
                ),
            },
            "summary": {
                "type": "string",
                "description": "2-4 sentence overall review, specific to what was submitted.",
            },
            "categories": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "key": {
                            "type": "string",
                            "enum": [
                                "correctness",
                                "code_quality",
                                "testing",
                                "documentation",
                            ],
                        },
                        "label": {"type": "string"},
                        "score": {
                            "type": "integer",
                            "minimum": 1,
                            "maximum": 5,
                        },
                    },
                    "required": ["key", "label", "score"],
                },
                "description": "Score all four categories: correctness, code_quality, testing, documentation.",
            },
            "comments": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "category": {
                            "type": "string",
                            "description": "Must match one of the categories[].key values above.",
                        },
                        "content": {"type": "string"},
                    },
                    "required": ["category", "content"],
                },
                "description": "Specific inline comments, referencing what's actually in the repo.",
            },
        },
        "required": ["verdict", "summary", "categories", "comments"],
    },
}

UPDATE_EMPLOYEE_FILE_TOOL = {
    "name": "update_employee_file",
    "description": (
        "Update the graduate's shared Employee File after reviewing their "
        "Mentor review history. This is the one record Manager, Mentor, "
        "and HR all read from."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "skills": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Skills actually demonstrated in reviewed work so far.",
            },
            "strengths": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Specific, evidence-based strengths — not generic praise.",
            },
            "growth_areas": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Actionable growth areas (e.g. 'add tests alongside a feature'), not vague ones.",
            },
            "summary": {
                "type": "string",
                "description": "2-4 sentence overall narrative of progress so far.",
            },
        },
        "required": ["skills", "strengths", "growth_areas", "summary"],
    },
}
