# Development plan

Hackathon deadline: **23 Oct 2026, 12:00 PM PDT = 24 Oct 2026, 12:30 AM IST** (per the research brief; re-check the live Devpost page). Internal target: submit on **23 Oct (IST)**. The starter in this repo already covers Phase 1 and a mock-mode slice of Phase 2.

## Roles

| Member                                     | Focus                                                                            |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| 1 – Ritesh (Lead, full stack, cloud)       | Architecture, API/MCP/DB, deployment, final tech demo                            |
| 2 – AI/ML                                  | Gemini evaluation, prompts, planning quality, edge cases                         |
| 3 – Research + presentation                | Problem/competitor research, deck, demo storyline                                |
| 4 – QA + submission                        | Test cases, bug reports, README review, demo-recording assets, submission checks |
| Everyone tests and joins the final review. |

## Day-by-day

| Dates     | Milestone                     | Exit criteria                                                                                                                                                     |
| --------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Oct 13–14 | **Foundation** (this starter) | Repo runs locally in mock mode; tests green; Devpost registration and Alexa+ track confirmed; read the official rules page                                        |
| Oct 15–17 | **Core with a real model**    | Gemini access confirmed (model, API key, tool use, budget); `AI_PROVIDER=gemini` produces valid plans; one full flow persists; plan quality tuned on 10+ prompts |
| Oct 18–20 | **Polish & test**             | Edge cases (duplicates, expiry, MCP down); UI polish; deploy backend (EC2) + frontend; fresh-clone setup verified; **feature freeze: end of Oct 20**              |
| Oct 21–22 | **Submission prep**           | README/license final; public demo video <3 min (YouTube/Vimeo); product-feedback fields drafted; repo access check (public license visible, or reviewers added)   |
| Oct 23    | **Submit**                    | Verify links/fields, submit early, keep confirmation                                                                                                              |

## MVP milestones

1. ✅ Mock mode: request → plan → approve → DB → dashboard (done in this starter, tested).
2. ⬜ Gemini provider verified live.
3. ⬜ Deployed public demo with access protection.
4. ⬜ Demo video + submission.

## Submission checklist

- [ ] Devpost registered, Alexa+ selected as primary track
- [ ] Working project with MCP (Streamable HTTP) used at runtime in the demo
- [ ] GitHub repo with source, setup instructions, visible open-source license (MIT included)
- [ ] Public demo video < 3 minutes showing the real product
- [ ] Product feedback fields completed for each tool/API/SDK used
- [ ] Optional: provider-specific challenge only if Gemini (or another eligible service) is genuinely integrated and documented
- [ ] All links and access verified; submitted before the deadline

## Prioritised backlog

1. Verify official Alexa+ rules for the custom-web/MCP route (see README assumptions).
2. Gemini live test + prompt tuning; choose model.
3. Deploy (EC2 + HTTPS) behind a simple access gate (basic auth/IP allow-list) since there is no auth.
4. Approval-recovery job for stuck APPROVED rows.
5. Task/grocery edit controls (mark done/purchased) via new approved tools.
6. Conversation history in planner context; show past plans.
7. Browser E2E test (Playwright) for the main flow.
8. Event/calendar support; real authentication.
