#!/usr/bin/env tsx

import { logger } from '../../src/lib/observability/logger';

export interface TestCase {
  name: string;
  fn: () => Promise<void> | void;
  timeout?: number;
  skip?: boolean;
  only?: boolean;
}

export interface TestSuite {
  name: string;
  tests: TestCase[];
  beforeAll?: () => Promise<void> | void;
  afterAll?: () => Promise<void> | void;
  beforeEach?: () => Promise<void> | void;
  afterEach?: () => Promise<void> | void;
}

export interface TestResult {
  suite: string;
  test: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  error?: string;
  stack?: string;
}

export interface TestSummary {
  totalSuites: number;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  results: TestResult[];
}

export class TestAssertionError extends Error {
  constructor(message: string, public expected?: any, public actual?: any) {
    super(message);
    this.name = 'TestAssertionError';
  }
}

export class TestRunner {
  private suites: TestSuite[] = [];
  private results: TestResult[] = [];

  addSuite(suite: TestSuite): void {
    this.suites.push(suite);
  }

  async runAll(): Promise<TestSummary> {
    const startTime = Date.now();
    this.results = [];

    logger.info(`Starting test execution (${this.suites.length} suites)`);

    for (const suite of this.suites) {
      await this.runSuite(suite);
    }

    const duration = Date.now() - startTime;
    const summary = this.generateSummary(duration);
    
    this.printSummary(summary);
    return summary;
  }

  private async runSuite(suite: TestSuite): Promise<void> {
    logger.info(`\n📦 Running suite: ${suite.name}`);

    try {
      // Run beforeAll hook
      if (suite.beforeAll) {
        await suite.beforeAll();
      }

      // Filter tests (skip, only)
      let testsToRun = suite.tests;
      const onlyTests = testsToRun.filter(t => t.only);
      if (onlyTests.length > 0) {
        testsToRun = onlyTests;
      }

      // Run each test
      for (const test of testsToRun) {
        if (test.skip) {
          this.results.push({
            suite: suite.name,
            test: test.name,
            status: 'skip',
            duration: 0
          });
          logger.warn(`  ⚠️  ${test.name} (skipped)`);
          continue;
        }

        await this.runTest(suite, test);
      }

      // Run afterAll hook
      if (suite.afterAll) {
        await suite.afterAll();
      }

    } catch (error) {
      logger.error(`Suite setup/teardown failed: ${suite.name}`, error);
    }
  }

  private async runTest(suite: TestSuite, test: TestCase): Promise<void> {
    const startTime = Date.now();

    try {
      // Run beforeEach hook
      if (suite.beforeEach) {
        await suite.beforeEach();
      }

      // Run the test with timeout
      const timeout = test.timeout || 5000;
      await this.withTimeout(test.fn(), timeout);

      // Run afterEach hook
      if (suite.afterEach) {
        await suite.afterEach();
      }

      const duration = Date.now() - startTime;
      this.results.push({
        suite: suite.name,
        test: test.name,
        status: 'pass',
        duration
      });

      logger.info(`  ✅ ${test.name} (${duration}ms)`);

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;

      this.results.push({
        suite: suite.name,
        test: test.name,
        status: 'fail',
        duration,
        error: errorMessage,
        stack
      });

      logger.error(`  ❌ ${test.name} (${duration}ms)`);
      logger.error(`     ${errorMessage}`);

      // Run afterEach even if test failed
      try {
        if (suite.afterEach) {
          await suite.afterEach();
        }
      } catch (cleanupError) {
        logger.error(`Test cleanup failed: ${cleanupError}`);
      }
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Test timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timer));
    });
  }

  private generateSummary(duration: number): TestSummary {
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const skipped = this.results.filter(r => r.status === 'skip').length;

    return {
      totalSuites: this.suites.length,
      totalTests: this.results.length,
      passed,
      failed,
      skipped,
      duration,
      results: this.results
    };
  }

  private printSummary(summary: TestSummary): void {
    logger.info('\n' + '='.repeat(60));
    logger.info('TEST SUMMARY');
    logger.info('='.repeat(60));
    
    logger.info(`Suites: ${summary.totalSuites}`);
    logger.info(`Tests:  ${summary.totalTests}`);
    logger.info(`Passed: ${summary.passed}`);
    logger.info(`Failed: ${summary.failed}`);
    logger.info(`Skipped: ${summary.skipped}`);
    logger.info(`Duration: ${summary.duration}ms`);

    if (summary.failed > 0) {
      logger.error('\nFAILED TESTS:');
      summary.results
        .filter(r => r.status === 'fail')
        .forEach(result => {
          logger.error(`❌ ${result.suite} > ${result.test}`);
          logger.error(`   ${result.error}`);
        });
    }

    logger.info('='.repeat(60));

    if (summary.failed > 0) {
      process.exit(1);
    }
  }
}

// ===================================
// ASSERTION HELPERS
// ===================================

export const assert = {
  equal(actual: any, expected: any, message?: string): void {
    if (actual !== expected) {
      throw new TestAssertionError(
        message || `Expected ${expected}, got ${actual}`,
        expected,
        actual
      );
    }
  },

  notEqual(actual: any, expected: any, message?: string): void {
    if (actual === expected) {
      throw new TestAssertionError(
        message || `Expected not to equal ${expected}`,
        expected,
        actual
      );
    }
  },

  deepEqual(actual: any, expected: any, message?: string): void {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new TestAssertionError(
        message || `Deep equality failed`,
        expected,
        actual
      );
    }
  },

  truthy(value: any, message?: string): void {
    if (!value) {
      throw new TestAssertionError(
        message || `Expected truthy value, got ${value}`,
        true,
        value
      );
    }
  },

  falsy(value: any, message?: string): void {
    if (value) {
      throw new TestAssertionError(
        message || `Expected falsy value, got ${value}`,
        false,
        value
      );
    }
  },

  throws(fn: () => any, expectedError?: string | RegExp, message?: string): void {
    try {
      fn();
      throw new TestAssertionError(
        message || 'Expected function to throw an error'
      );
    } catch (error) {
      if (expectedError) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (typeof expectedError === 'string') {
          if (!errorMessage.includes(expectedError)) {
            throw new TestAssertionError(
              message || `Expected error containing "${expectedError}", got "${errorMessage}"`
            );
          }
        } else if (expectedError instanceof RegExp) {
          if (!expectedError.test(errorMessage)) {
            throw new TestAssertionError(
              message || `Expected error matching ${expectedError}, got "${errorMessage}"`
            );
          }
        }
      }
    }
  },

  async rejects(promise: Promise<any>, expectedError?: string | RegExp, message?: string): Promise<void> {
    try {
      await promise;
      throw new TestAssertionError(
        message || 'Expected promise to reject'
      );
    } catch (error) {
      if (expectedError) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (typeof expectedError === 'string') {
          if (!errorMessage.includes(expectedError)) {
            throw new TestAssertionError(
              message || `Expected error containing "${expectedError}", got "${errorMessage}"`
            );
          }
        } else if (expectedError instanceof RegExp) {
          if (!expectedError.test(errorMessage)) {
            throw new TestAssertionError(
              message || `Expected error matching ${expectedError}, got "${errorMessage}"`
            );
          }
        }
      }
    }
  },

  async resolves(promise: Promise<any>, message?: string): Promise<any> {
    try {
      return await promise;
    } catch (error) {
      throw new TestAssertionError(
        message || `Expected promise to resolve, but it rejected with: ${error}`
      );
    }
  },

  type(value: any, expectedType: string, message?: string): void {
    const actualType = typeof value;
    if (actualType !== expectedType) {
      throw new TestAssertionError(
        message || `Expected type ${expectedType}, got ${actualType}`,
        expectedType,
        actualType
      );
    }
  },

  instanceOf(value: any, expectedClass: any, message?: string): void {
    if (!(value instanceof expectedClass)) {
      throw new TestAssertionError(
        message || `Expected instance of ${expectedClass.name}`,
        expectedClass.name,
        value?.constructor?.name || typeof value
      );
    }
  },

  arrayIncludes(array: any[], value: any, message?: string): void {
    if (!Array.isArray(array)) {
      throw new TestAssertionError(
        message || 'Expected array for includes check',
        'array',
        typeof array
      );
    }
    
    if (!array.includes(value)) {
      throw new TestAssertionError(
        message || `Expected array to include ${value}`,
        `array including ${value}`,
        array
      );
    }
  },

  objectHasProperty(obj: any, property: string, message?: string): void {
    if (typeof obj !== 'object' || obj === null) {
      throw new TestAssertionError(
        message || 'Expected object for property check',
        'object',
        typeof obj
      );
    }
    
    if (!(property in obj)) {
      throw new TestAssertionError(
        message || `Expected object to have property "${property}"`,
        `object with property ${property}`,
        Object.keys(obj)
      );
    }
  }
};

// ===================================
// MOCK HELPERS
// ===================================

export class MockFunction<T extends (...args: any[]) => any> {
  private calls: Array<{ args: Parameters<T>; result?: ReturnType<T>; error?: Error }> = [];
  private implementation?: T;

  constructor(implementation?: T) {
    this.implementation = implementation;
  }

  mockImplementation(fn: T): this {
    this.implementation = fn;
    return this;
  }

  mockReturnValue(value: ReturnType<T>): this {
    this.implementation = ((...args: any[]) => value) as T;
    return this;
  }

  mockResolvedValue(value: ReturnType<T> extends Promise<infer U> ? U : never): this {
    this.implementation = ((...args: any[]) => Promise.resolve(value)) as T;
    return this;
  }

  mockRejectedValue(error: Error): this {
    this.implementation = ((...args: any[]) => Promise.reject(error)) as T;
    return this;
  }

  call(...args: Parameters<T>): ReturnType<T> {
    try {
      const result = this.implementation ? this.implementation(...args) : undefined;
      this.calls.push({ args, result });
      return result;
    } catch (error) {
      this.calls.push({ args, error: error as Error });
      throw error;
    }
  }

  getCalls(): Array<{ args: Parameters<T>; result?: ReturnType<T>; error?: Error }> {
    return [...this.calls];
  }

  getCallCount(): number {
    return this.calls.length;
  }

  wasCalledWith(...args: Parameters<T>): boolean {
    return this.calls.some(call => 
      call.args.length === args.length &&
      call.args.every((arg, index) => arg === args[index])
    );
  }

  reset(): void {
    this.calls = [];
  }
}

export function createMock<T extends (...args: any[]) => any>(implementation?: T): MockFunction<T> {
  return new MockFunction(implementation);
}

// ===================================
// TEST UTILITIES
// ===================================

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function createTestData<T>(template: T, overrides: Partial<T> = {}): T {
  return { ...template, ...overrides };
}

export function randomString(length: number = 10): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

export function randomEmail(): string {
  return `test-${randomString(8)}@example.com`;
}

export function randomUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}