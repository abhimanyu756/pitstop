# Pit Stop - Jira Forge App

## Setup

1.  **Install Dependencies**

    ```bash
    npm install
    ```

2.  **Login to Forge** (if not already logged in)

    ```bash
    forge login
    ```

3.  **Register the App**
    ```bash
    forge register
    ```

## Deployment & Installation

1.  **Deploy to Development Environment**

    ```bash
    forge deploy
    ```

2.  **Install into your Jira Site**
    ```bash
    forge install
    ```
    - Select `Jira` as the product.
    - Enter your Atlassian site URL (e.g., `your-site.atlassian.net`).

## Development

- **Run Tunnel** (for local testing with hot-reloading)

  ```bash
  forge tunnel
  ```

  - _Note:_ You must have Docker running for `forge tunnel`.

- **View Logs**
  ```bash
  forge logs
  ```

## Features

- **Rovo Agent**: "Pit Stop Crew Chief" (Available in Rovo Chat).
- **Stall Detector**: Runs hourly to check for stalled tickets.
