export default {
  preset: 'ts-jest',
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapper: {
    '\\.(css|sass)$': 'identity-obj-proxy',
    '^@ant-design/icons$': '<rootDir>/src/__mocks__/@ant-design/icons.js',
    '^antd$': '<rootDir>/src/__mocks__/antd.js',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  testMatch: ['<rootDir>/src/**/*.test.(ts|tsx)'],
};
