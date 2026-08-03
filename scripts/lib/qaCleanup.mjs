function errorMessage(error) {
  if (error instanceof Error) return error.message;
  if (typeof error?.message === 'string') return error.message;
  return String(error || 'unknown cleanup error');
}

export function createQaCleanupTracker(label = 'QA cleanup') {
  const failures = [];

  return {
    failures,

    async check(step, operation) {
      try {
        const result = await (typeof operation === 'function' ? operation() : operation);
        if (result?.error) failures.push(`${step}: ${errorMessage(result.error)}`);
        return result;
      } catch (error) {
        failures.push(`${step}: ${errorMessage(error)}`);
        return null;
      }
    },

    assertComplete() {
      if (failures.length === 0) return;
      throw new Error(`${label} failed:\n- ${failures.join('\n- ')}`);
    },
  };
}
