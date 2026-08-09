Document everything related to the mobile version of the application and fully validate the mobile workflow end-to-end. Launch the app on the iOS simulator, inspect rendering and behavior across screens using computer-use tools, and verify that the UI, responsiveness, navigation, and interactions work correctly. If any issues appear, investigate and fix them directly, then re-test to confirm stability.

Run and validate the application through Xcode, ensuring the mobile build process, dependencies, simulator execution, and runtime behavior are functioning properly.

Use a dual-agent workflow:
- Agent 1: Critical reviewer — aggressively inspects the app, challenges implementation decisions, identifies UI/UX flaws, rendering inconsistencies, performance issues, edge cases, and architectural weaknesses.
- Agent 2: Solution engineer — proposes and implements the most practical, efficient, production-ready fixes with minimal unnecessary complexity.

The final result should include:
- Full mobile QA/testing documentation
- Screens/issues discovered
- Root-cause analysis
- Applied fixes
- Validation results after fixes
- Remaining risks or technical debt
- Recommendations for production readiness