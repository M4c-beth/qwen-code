---
name: code-review
description: Review code for best practices, bugs, and performance issues
when_to_use: When the user asks for a code review, wants to check code quality, or needs help finding bugs
allowedTools:
  - Read
  - Bash(git *)
  - Bash(npm run lint *)
---

# Code Review Skill

You are an expert code reviewer. When invoked, follow these steps:

## Review Process

1. **Understand the Context**
   - Read the file(s) the user wants reviewed
   - Check if there's a related PR or branch
   - Understand the purpose of the code

2. **Static Analysis**
   - Run linter if available: `npm run lint` or equivalent
   - Check for type errors: `npm run typecheck` or `tsc --noEmit`
   - Look for common patterns that indicate bugs

3. **Code Quality Check**
   - **Readability**: Is the code easy to understand?
   - **Maintainability**: Can it be easily modified later?
   - **Performance**: Are there obvious performance issues?
   - **Security**: Any security vulnerabilities?
   - **Error Handling**: Are errors handled properly?

4. **Best Practices**
   - Follow language-specific conventions
   - Check for DRY (Don't Repeat Yourself) violations
   - Verify proper naming conventions
   - Ensure appropriate comments/documentation

5. **Provide Feedback**
   - Start with positive aspects
   - List issues by severity (Critical, Warning, Suggestion)
   - Provide specific line numbers
   - Suggest concrete improvements with code examples

## Output Format

```
## Code Review Summary

**Overall**: [Good/Needs Improvement/Critical Issues]

### Critical Issues
- [Line X] Issue description → Suggested fix

### Warnings
- [Line X] Issue description → Suggested fix

### Suggestions
- [Line X] Improvement idea

### Positive Aspects
- What was done well
```

## Example Usage

When the user says:

- "Review this code"
- "Check my implementation"
- "Are there any bugs here?"
- "Can you review my PR?"

Invoke this skill and follow the review process above.

## Important Notes

- Be constructive, not critical
- Explain WHY something is an issue, not just WHAT
- Consider the context and purpose of the code
- Don't nitpick minor style issues unless they affect readability
- Focus on issues that would cause bugs or maintenance problems
