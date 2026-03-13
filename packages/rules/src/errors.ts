/**
 * Thrown when rule configuration options fail validation.
 *
 * Reusable by CLI, SDK, and any future consumer that needs to
 * surface configuration problems in a typed, structured way.
 *
 * @example
 * ```ts
 * throw new RuleConfigurationError(
 *   "low-retrieval-score",
 *   "averageScoreThreshold",
 *   "must be between 0 and 1",
 * );
 * ```
 */
export class RuleConfigurationError extends Error {
  public readonly code = "RULE_CONFIGURATION_ERROR" as const;

  constructor(
    /** The rule ID that has the bad option */
    public readonly ruleId: string,
    /** The option key that is invalid */
    public readonly optionKey: string,
    /** Human-readable description of the constraint violated */
    public readonly constraint: string,
  ) {
    super(`Rule "${ruleId}": invalid option "${optionKey}" — ${constraint}`);
    this.name = "RuleConfigurationError";
  }
}
