/**
 * Circuit Breaker Pattern Implementation
 *
 * Provides resilience for external API calls by preventing cascading failures.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit is tripped, requests fail fast
 * - HALF_OPEN: Testing if service recovered, allows limited requests
 *
 * Transitions:
 * - CLOSED → OPEN: When failure count exceeds threshold
 * - OPEN → HALF_OPEN: After timeout period
 * - HALF_OPEN → CLOSED: When test request succeeds
 * - HALF_OPEN → OPEN: When test request fails
 */

// ============================================================================
// Types
// ============================================================================

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN"

export interface CircuitBreakerConfig {
  name: string
  failureThreshold: number // Number of failures before opening circuit
  successThreshold: number // Number of successes to close circuit (in HALF_OPEN)
  timeout: number // Time in ms before transitioning from OPEN to HALF_OPEN
  halfOpenMaxCalls: number // Max concurrent calls allowed in HALF_OPEN state
}

export interface CircuitBreakerState {
  name: string
  state: CircuitState
  failureCount: number
  successCount: number
  lastFailureTime: number | null
  lastSuccessTime: number | null
  lastStateChange: number
  totalCalls: number
  totalFailures: number
  totalSuccesses: number
  consecutiveFailures: number
  consecutiveSuccesses: number
  halfOpenCalls: number
}

export interface CircuitBreakerMetrics {
  name: string
  state: CircuitState
  failureRate: number // Percentage of failures
  avgLatencyMs: number
  lastFailure: string | null
  lastSuccess: string | null
  uptime: number // Percentage of time in CLOSED state
}

// ============================================================================
// Default Configurations
// ============================================================================

const DEFAULT_CONFIG: Omit<CircuitBreakerConfig, "name"> = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000, // 30 seconds
  halfOpenMaxCalls: 3,
}

// Pre-configured breakers for known services
export const CIRCUIT_CONFIGS: Record<string, CircuitBreakerConfig> = {
  redfin: {
    name: "redfin",
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 60000, // 1 minute
    halfOpenMaxCalls: 1,
  },
  linkup: {
    name: "linkup",
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000,
    halfOpenMaxCalls: 2,
  },
  fred: {
    name: "fred",
    failureThreshold: 5,
    successThreshold: 1,
    timeout: 60000,
    halfOpenMaxCalls: 2,
  },
  schooldigger: {
    name: "schooldigger",
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000,
    halfOpenMaxCalls: 2,
  },
  walkscore: {
    name: "walkscore",
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000,
    halfOpenMaxCalls: 2,
  },
  supabase: {
    name: "supabase",
    failureThreshold: 10,
    successThreshold: 3,
    timeout: 15000,
    halfOpenMaxCalls: 5,
  },
}

// ============================================================================
// Circuit Breaker Class
// ============================================================================

export class CircuitBreaker {
  private config: CircuitBreakerConfig
  private state: CircuitBreakerState
  private latencies: number[] = []
  private maxLatencySamples = 100
  private stateHistory: Array<{ state: CircuitState; timestamp: number }> = []

  constructor(config: Partial<CircuitBreakerConfig> & { name: string }) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.state = {
      name: this.config.name,
      state: "CLOSED",
      failureCount: 0,
      successCount: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      lastStateChange: Date.now(),
      totalCalls: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      halfOpenCalls: 0,
    }
    this.stateHistory.push({ state: "CLOSED", timestamp: Date.now() })
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we should allow the call
    if (!this.canExecute()) {
      throw new CircuitBreakerError(
        `Circuit breaker '${this.config.name}' is OPEN`,
        this.config.name,
        this.state.state
      )
    }

    // Track call in HALF_OPEN state
    if (this.state.state === "HALF_OPEN") {
      this.state.halfOpenCalls++
    }

    this.state.totalCalls++
    const startTime = Date.now()

    try {
      const result = await fn()
      this.onSuccess(Date.now() - startTime)
      return result
    } catch (error) {
      this.onFailure(Date.now() - startTime)
      throw error
    }
  }

  /**
   * Check if a call should be allowed
   */
  canExecute(): boolean {
    this.checkStateTransition()

    switch (this.state.state) {
      case "CLOSED":
        return true

      case "OPEN":
        return false

      case "HALF_OPEN":
        // Allow limited calls in HALF_OPEN
        return this.state.halfOpenCalls < this.config.halfOpenMaxCalls

      default:
        return false
    }
  }

  /**
   * Check for automatic state transitions
   */
  private checkStateTransition(): void {
    if (this.state.state === "OPEN") {
      const timeSinceLastFailure = this.state.lastFailureTime
        ? Date.now() - this.state.lastFailureTime
        : Infinity

      if (timeSinceLastFailure >= this.config.timeout) {
        this.transitionTo("HALF_OPEN")
      }
    }
  }

  /**
   * Record a successful call
   */
  private onSuccess(latencyMs: number): void {
    this.recordLatency(latencyMs)
    this.state.totalSuccesses++
    this.state.consecutiveSuccesses++
    this.state.consecutiveFailures = 0
    this.state.lastSuccessTime = Date.now()

    if (this.state.state === "HALF_OPEN") {
      this.state.successCount++
      this.state.halfOpenCalls--

      if (this.state.successCount >= this.config.successThreshold) {
        this.transitionTo("CLOSED")
      }
    } else if (this.state.state === "CLOSED") {
      // Reset failure count on success in CLOSED state
      this.state.failureCount = 0
    }

    console.log(
      `[CircuitBreaker:${this.config.name}] Success (${latencyMs}ms, state=${this.state.state})`
    )
  }

  /**
   * Record a failed call
   */
  private onFailure(latencyMs: number): void {
    this.recordLatency(latencyMs)
    this.state.totalFailures++
    this.state.consecutiveFailures++
    this.state.consecutiveSuccesses = 0
    this.state.lastFailureTime = Date.now()
    this.state.failureCount++

    if (this.state.state === "HALF_OPEN") {
      this.state.halfOpenCalls--
      this.transitionTo("OPEN")
    } else if (this.state.state === "CLOSED") {
      if (this.state.failureCount >= this.config.failureThreshold) {
        this.transitionTo("OPEN")
      }
    }

    console.warn(
      `[CircuitBreaker:${this.config.name}] Failure #${this.state.failureCount} (${latencyMs}ms, state=${this.state.state})`
    )
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state.state
    if (oldState === newState) return

    console.log(
      `[CircuitBreaker:${this.config.name}] State transition: ${oldState} → ${newState}`
    )

    this.state.state = newState
    this.state.lastStateChange = Date.now()
    this.stateHistory.push({ state: newState, timestamp: Date.now() })

    // Reset counters on state change
    if (newState === "CLOSED") {
      this.state.failureCount = 0
      this.state.successCount = 0
    } else if (newState === "HALF_OPEN") {
      this.state.successCount = 0
      this.state.halfOpenCalls = 0
    }
  }

  /**
   * Record latency for metrics
   */
  private recordLatency(latencyMs: number): void {
    this.latencies.push(latencyMs)
    if (this.latencies.length > this.maxLatencySamples) {
      this.latencies.shift()
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    this.checkStateTransition()
    return { ...this.state }
  }

  /**
   * Get metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    this.checkStateTransition()

    const failureRate =
      this.state.totalCalls > 0
        ? this.state.totalFailures / this.state.totalCalls
        : 0

    const avgLatencyMs =
      this.latencies.length > 0
        ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length
        : 0

    // Calculate uptime (time in CLOSED state)
    let closedTime = 0
    let totalTime = 0
    for (let i = 0; i < this.stateHistory.length; i++) {
      const current = this.stateHistory[i]
      const next = this.stateHistory[i + 1]
      const endTime = next?.timestamp || Date.now()
      const duration = endTime - current.timestamp

      totalTime += duration
      if (current.state === "CLOSED") {
        closedTime += duration
      }
    }

    return {
      name: this.config.name,
      state: this.state.state,
      failureRate,
      avgLatencyMs: Math.round(avgLatencyMs),
      lastFailure: this.state.lastFailureTime
        ? new Date(this.state.lastFailureTime).toISOString()
        : null,
      lastSuccess: this.state.lastSuccessTime
        ? new Date(this.state.lastSuccessTime).toISOString()
        : null,
      uptime: totalTime > 0 ? closedTime / totalTime : 1,
    }
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    console.log(`[CircuitBreaker:${this.config.name}] Manual reset`)
    this.state = {
      name: this.config.name,
      state: "CLOSED",
      failureCount: 0,
      successCount: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      lastStateChange: Date.now(),
      totalCalls: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      halfOpenCalls: 0,
    }
    this.latencies = []
    this.stateHistory = [{ state: "CLOSED", timestamp: Date.now() }]
  }

  /**
   * Force open the circuit (for testing or manual intervention)
   */
  forceOpen(): void {
    console.log(`[CircuitBreaker:${this.config.name}] Forced OPEN`)
    this.transitionTo("OPEN")
  }

  /**
   * Force close the circuit (for testing or manual intervention)
   */
  forceClose(): void {
    console.log(`[CircuitBreaker:${this.config.name}] Forced CLOSED`)
    this.transitionTo("CLOSED")
  }
}

// ============================================================================
// Custom Error
// ============================================================================

export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly circuitName: string,
    public readonly circuitState: CircuitState
  ) {
    super(message)
    this.name = "CircuitBreakerError"
  }
}

// ============================================================================
// Circuit Breaker Registry
// ============================================================================

class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>()

  /**
   * Get or create a circuit breaker
   */
  get(name: string): CircuitBreaker {
    if (!this.breakers.has(name)) {
      const config = CIRCUIT_CONFIGS[name] || { name }
      this.breakers.set(name, new CircuitBreaker(config))
    }
    return this.breakers.get(name)!
  }

  /**
   * Get all circuit breakers
   */
  getAll(): CircuitBreaker[] {
    return Array.from(this.breakers.values())
  }

  /**
   * Get metrics for all breakers
   */
  getAllMetrics(): CircuitBreakerMetrics[] {
    return this.getAll().map((b) => b.getMetrics())
  }

  /**
   * Reset all breakers
   */
  resetAll(): void {
    this.breakers.forEach((b) => b.reset())
  }

  /**
   * Check if any breaker is open
   */
  hasOpenCircuit(): boolean {
    return this.getAll().some((b) => b.getState().state === "OPEN")
  }
}

// Singleton registry
export const circuitBreakers = new CircuitBreakerRegistry()

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Execute a function with circuit breaker protection
 * Convenience wrapper around circuitBreakers.get(name).execute(fn)
 */
export async function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  return circuitBreakers.get(name).execute(fn)
}

/**
 * Execute with fallback if circuit is open
 */
export async function withCircuitBreakerAndFallback<T>(
  name: string,
  fn: () => Promise<T>,
  fallback: () => T | Promise<T>
): Promise<T> {
  try {
    return await circuitBreakers.get(name).execute(fn)
  } catch (error) {
    if (error instanceof CircuitBreakerError) {
      console.log(
        `[CircuitBreaker:${name}] Using fallback due to ${error.circuitState} state`
      )
      return fallback()
    }
    throw error
  }
}

/**
 * Check if a service is available (circuit is not open)
 */
export function isServiceAvailable(name: string): boolean {
  return circuitBreakers.get(name).canExecute()
}

/**
 * Get circuit breaker status summary
 */
export function getCircuitBreakerSummary(): {
  total: number
  closed: number
  open: number
  halfOpen: number
  services: Array<{ name: string; state: CircuitState; failureRate: number }>
} {
  const metrics = circuitBreakers.getAllMetrics()

  return {
    total: metrics.length,
    closed: metrics.filter((m) => m.state === "CLOSED").length,
    open: metrics.filter((m) => m.state === "OPEN").length,
    halfOpen: metrics.filter((m) => m.state === "HALF_OPEN").length,
    services: metrics.map((m) => ({
      name: m.name,
      state: m.state,
      failureRate: m.failureRate,
    })),
  }
}
