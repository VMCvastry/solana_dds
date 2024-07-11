### Introduction

-   **Background on Solana**: Introduce Solana, highlighting its unique features compared to other blockchain technologies, such as its consensus mechanism (Proof of History) and its focus on high throughput and low latency.
-   **Purpose and Intent of Solana**: Discuss the overarching goals of Solana: Gas free, extremely high throughput, high focus on Dapp scalability, way faster iteration

### Solana's Evolution

-   **Brief History**: Trace the development of Solana, focusing on major milestones, updates and popularity.
-   **Challenges**: Outline past challenges, outages and major problems and their impact.

### The April 2024 Crisis

-   **Non-Technical Overview**: Describe the events of April 2024, focusing on the impact of NFT spam and the resultant network congestion.
-   **Impact on Stakeholders**: Explore how various users of the network—traders, app developers, and casual users—were affected and the impact on the chain and on the overall crypto ecosystem

### Technical Analysis

-   **Introduction to QUIC Protocol**: Explain what QUIC is, its intended benefits, and why Solana chose to implement it.
-   **Issues with QUIC Implementation**: Analyze the technical reasons why QUIC's implementation was flawed, leading to unreliability under high traffic conditions.

### High Priority Fee Transactions

-   **Problem Overview**: Analyze the specific issue with high-priority fee transactions not being prioritized during network congestion.
-   **Solana's Response**: Discuss the claimed fix introduced in version 1.18, and describe the actual changes made focusing on the new transaction scheduler.
-   **Comparison of Schedulers**: Provide a detailed comparison between the old and new transaction schedulers, illustrating how the new scheduler effectively prioritizes transactions.

### Technical Replication and Validation

-   **Replication of the Issue**: Describe the used approach to replicating the edge case scenario where low priority transactions were processed before high priority ones under the old scheduler.
-   **Validation of Fixes**: Show how the new scheduler does not exhibit the same issues.

### Conclusion
