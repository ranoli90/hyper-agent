import { scan } from 'sonarqube-scanner';

scan(
  {
    serverUrl: 'https://sonarcloud.io',
    token: process.env.SONAR_TOKEN || '6ce275525e940540cbadaeda21973a6923201dd7',
    options: {
      'sonar.projectKey': 'ranoli90_hyper-agent',
      'sonar.organization': 'ranoli90',
      'sonar.sources': 'entrypoints,shared',
      'sonar.tests': 'tests',
      'sonar.test.inclusions': '**/*.test.ts,**/*.spec.ts',
      'sonar.javascript.lcov.reportPaths': 'coverage/lcov.info',
      'sonar.coverage.exclusions': '**/*.test.ts,**/*.spec.ts,**/node_modules/**',
      'sonar.exclusions': '**/node_modules/**,**/dist/**,**/build/**,**/*.d.ts',
      'sonar.sourceEncoding': 'UTF-8',
    },
  },
  () => process.exit()
);