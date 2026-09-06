// Mirrors backend/app/models.py's User.employee_file relationship:
// skills_json, strengths_json, growth_areas_json, summary_text. This is
// the one record Manager, Mentor, and HR all read from and write to —
// see frontend/DESIGN.md and the home board's Employee File node for
// why that matters. Mock only for now; HR is what would actually
// maintain this once agent logic exists.
export interface EmployeeFile {
  skills: string[];
  strengths: string[];
  growthAreas: string[];
  summary: string;
}

export const EMPLOYEE_FILE: EmployeeFile = {
  skills: ["Next.js", "Tailwind CSS", "React Flow", "TypeScript"],
  strengths: [
    "Follows the team's agreed structure and conventions closely",
    "PR descriptions explain the approach, not just the change",
    "Fast to submit — doesn't sit on finished work",
  ],
  growthAreas: [
    "Add tests alongside a feature, not as a follow-up task",
    "Update docs in the same PR when behavior changes",
  ],
  summary:
    "Three tasks in, consistently meets requirements and communicates clearly. Testing and docs were thin early on but improved noticeably on the most recent task — worth watching whether that holds.",
};
