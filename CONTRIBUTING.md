# Contributing to AWS IoT Shadow Management

Thank you for your interest in contributing to the AWS IoT Shadow Management with Fleet Provisioning project! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Enhancements](#suggesting-enhancements)
- [Documentation](#documentation)

## Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow. Please:

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

1. **Fork the repository** to your own GitHub account
2. **Clone your fork** to your local machine:
   ```bash
   git clone https://github.com/your-username/iot.git
   cd iot
   ```
3. **Add upstream remote** to keep your fork synchronized:
   ```bash
   git remote add upstream https://github.com/original-owner/iot.git
   ```

## Development Setup

### Prerequisites

- **AWS Account** with appropriate permissions
- **AWS CLI** configured with credentials
- **Node.js** 18.x or later
- **npm** 9.x or later
- **Serverless Framework** 3.x or later
- **Python** 3.8+ (for device client examples)
- **Git** for version control

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Install development tools**:
   ```bash
   npm install -g serverless
   npm install -g eslint
   ```

3. **Configure AWS credentials**:
   ```bash
   aws configure
   ```

4. **Deploy to development environment**:
   ```bash
   npm run deploy:dev
   ```

### Project Structure

```
iot/
├── src/
│   └── handlers/          # Lambda function handlers
│       ├── provisioning/  # Fleet provisioning handlers
│       ├── shadow/        # Shadow management handlers
│       └── api/          # API endpoint handlers
├── examples/             # Device client examples
│   ├── device-client-python/
│   └── device-client-nodejs/
├── docs/                 # Additional documentation
├── tests/               # Test files (to be added)
├── serverless.yml       # Infrastructure configuration
└── package.json         # Node.js dependencies
```

## How to Contribute

### Types of Contributions

We welcome various types of contributions:

1. **Bug Fixes**: Fix issues and improve reliability
2. **Features**: Add new functionality
3. **Documentation**: Improve or add documentation
4. **Tests**: Add or improve test coverage
5. **Examples**: Provide additional usage examples
6. **Performance**: Optimize existing code

### Contribution Workflow

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

2. **Make your changes** following the coding standards

3. **Test your changes** thoroughly

4. **Commit your changes** with clear messages:
   ```bash
   git add .
   git commit -m "feat: add support for device groups management"
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request** from your fork to the main repository

## Coding Standards

### JavaScript/Node.js

- **Use ES6+ syntax** (const, let, arrow functions, async/await)
- **Follow ESLint rules** defined in the project
- **Use meaningful variable names**
- **Add JSDoc comments** for functions:
  ```javascript
  /**
   * Validates device serial number format
   * @param {string} serialNumber - The device serial number
   * @returns {boolean} True if valid, false otherwise
   */
  function validateSerialNumber(serialNumber) {
    // implementation
  }
  ```

### Python

- **Follow PEP 8** style guide
- **Use type hints** where appropriate
- **Add docstrings** for functions and classes:
  ```python
  def validate_serial_number(serial_number: str) -> bool:
      """
      Validates device serial number format.

      Args:
          serial_number: The device serial number to validate

      Returns:
          True if valid, False otherwise
      """
      # implementation
  ```

### General Guidelines

- **Keep functions small** and focused on a single responsibility
- **Avoid code duplication** - use helper functions
- **Handle errors gracefully** with proper error messages
- **Use async/await** for asynchronous operations
- **Add error handling** for AWS SDK calls
- **Use environment variables** for configuration
- **Avoid hardcoded values** - use constants or config

### Git Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- **feat**: A new feature
  ```
  feat: add support for named shadows
  ```

- **fix**: A bug fix
  ```
  fix: resolve shadow delta calculation error
  ```

- **docs**: Documentation changes
  ```
  docs: update deployment guide with multi-region setup
  ```

- **style**: Code style changes (formatting, missing semi-colons, etc.)
  ```
  style: format code with prettier
  ```

- **refactor**: Code refactoring
  ```
  refactor: extract shadow validation logic to separate module
  ```

- **test**: Adding or updating tests
  ```
  test: add unit tests for pre-provisioning hook
  ```

- **chore**: Maintenance tasks
  ```
  chore: update dependencies to latest versions
  ```

## Testing Guidelines

### Unit Tests

Add unit tests for new functions:

```javascript
// tests/handlers/provisioning/preProvisioningHook.test.js
const { handler } = require('../../../src/handlers/provisioning/preProvisioningHook');

describe('Pre-Provisioning Hook', () => {
  it('should validate correct serial number', async () => {
    const event = {
      parameters: {
        SerialNumber: 'ABC12345678'
      }
    };

    const result = await handler(event);
    expect(result.allowProvisioning).toBe(true);
  });
});
```

### Integration Tests

Test Lambda functions with AWS services:

```javascript
describe('Shadow Update Handler Integration', () => {
  it('should store shadow update in DynamoDB', async () => {
    // Test implementation
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

## Pull Request Process

### Before Submitting

- [ ] Code follows project style guidelines
- [ ] All tests pass locally
- [ ] New code has appropriate test coverage
- [ ] Documentation is updated if needed
- [ ] Commit messages follow conventional commits format
- [ ] No unnecessary files are included

### PR Title Format

Use the same format as commit messages:

```
feat: add device certificate rotation support
fix: resolve connection timeout issue in device client
docs: improve API documentation with examples
```

### PR Description Template

```markdown
## Description
Brief description of the changes

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update

## Testing
Describe the tests you ran and how to reproduce them

## Checklist
- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes

## Screenshots (if applicable)

## Additional Notes
```

### Review Process

1. **Automated checks** will run (linting, tests)
2. **Maintainers will review** your code
3. **Address feedback** by pushing new commits
4. **Squash and merge** once approved

## Reporting Bugs

### Before Reporting

1. **Check existing issues** to avoid duplicates
2. **Test with the latest version**
3. **Gather necessary information**

### Bug Report Template

```markdown
**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Deploy to '...'
2. Configure '....'
3. Run command '....'
4. See error

**Expected behavior**
What you expected to happen.

**Actual behavior**
What actually happened.

**Environment**
- AWS Region: [e.g., us-east-1]
- Node.js version: [e.g., 18.x]
- Serverless Framework version: [e.g., 3.38.0]
- Stage: [e.g., dev]

**Logs**
```
Paste relevant logs here
```

**Screenshots**
If applicable, add screenshots to help explain the problem.

**Additional context**
Add any other context about the problem here.
```

## Suggesting Enhancements

### Enhancement Template

```markdown
**Is your feature request related to a problem?**
A clear description of the problem.

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
Any alternative solutions or features you've considered.

**Additional context**
Add any other context or screenshots about the feature request.

**Proposed Implementation**
If you have ideas on how to implement this, please share.
```

## Documentation

### Documentation Standards

- Use **clear, concise language**
- Include **code examples** where applicable
- Add **diagrams** for complex concepts
- Keep documentation **up-to-date** with code changes
- Follow **Markdown** best practices

### Documentation Types

1. **README.md**: Overview and quick start
2. **ARCHITECTURE.md**: System design and architecture
3. **DEPLOYMENT.md**: Deployment procedures
4. **COMPONENTS.md**: Component descriptions
5. **API.md**: API documentation (if applicable)
6. **CHANGELOG.md**: Version history

### Example Documentation

````markdown
## Feature Name

Brief description of the feature.

### Usage

```bash
# Command example
serverless deploy --stage dev
```

### Configuration

```yaml
# serverless.yml example
custom:
  deviceTimeout: 300
```

### Example

```javascript
// Code example
const result = await updateShadow(thingName, state);
```
````

## Community

### Getting Help

- Review the [README.md](./README.md) and documentation
- Check [existing issues](https://github.com/your-repo/issues)
- Ask questions in discussions

### Stay Updated

- Watch the repository for updates
- Follow the [CHANGELOG.md](./CHANGELOG.md)
- Review closed PRs for recent changes

## License

By contributing, you agree that your contributions will be licensed under the same [MIT License](./LICENSE) that covers this project.

## Recognition

Contributors will be recognized in:
- Repository contributors list
- CHANGELOG.md (for significant contributions)
- README.md acknowledgments section (for major features)

## Questions?

If you have questions about contributing, please:
1. Check this guide first
2. Review existing documentation
3. Open a discussion or issue
4. Reach out to maintainers

Thank you for contributing to make this project better! 🎉
