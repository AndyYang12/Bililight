# bililight

<a href="README_zh.md">中文</a>
<a href="README.md">English</a>

A lightweight third-party web client for Bilibili, designed to provide a simple, browser-based Bilibili experience across different devices including phones, tablets, and smartwatches. Developed by Andy12, initiated by loughead, project start date: December 2025.

> **Project Status: Base is Complete

## Project Goals

bililight aims to recreate the core browsing and interaction experience of Bilibili in the browser while keeping pages lightweight, fast-loading, and adaptable to small screens and non-traditional devices such as smartwatches. The project does not host video content; all content comes from Bilibili's official services, and the client serves only as a frontend presentation and interaction layer.

## Planned Features

1. **Video playback and personalized recommendations**: Watch Bilibili videos online and receive recommended content based on user preferences.
2. **Cloudflare-proxied JSON storage**: Use Cloudflare Workers or KV to store selected non-sensitive JSON data (such as caches and configuration) to reduce load on the origin.
3. **Account login and personal data**: Users can log in with their own Bilibili account to view watch history, favorites, Watch Later, and the message center.
4. **Comments and interactions**: Post comments, reply to others, and perform the "triple action" (like, coin, favorite).
5. **Download module**: Provide an entry point for downloading videos (the specific implementation depends on the availability and compliance of Bilibili's interfaces).
6. **Video upload entry**: Include an "Upload Video" button that redirects to Bilibili's official Creator Center.
7. **Search**: Search for videos and display result lists.
8. **Following feed**: View dynamic updates from followed uploaders.
9. **Multi-device adaptation**: The interface should adapt to different screen sizes and interaction methods across phones, tablets, and watches.
10. **Player controls**: Adjust playback speed, quality, progress, and subtitles while watching videos.

## Technical Direction (Draft)

- **Frontend**: Plan to use a modern frontend framework to build a responsive interface, with emphasis on layout and touch interaction optimization for small screens.
- **Backend / Proxy layer**: Use Node.js to provide a lightweight API proxy that forwards requests to Bilibili's public interfaces and handles necessary signature calculations.
- **Data storage**: Non-sensitive cache and configuration data may use Cloudflare's free storage services.
- **Deployment**: The goal is to run basic browsing functionality on low-spec servers (e.g., a 1-core instance), but login and user-data-related features require additional resources and security considerations.

## Important Notes and Limitations

- **Login and user data**: Bilibili's login, history, favorites, comments, and triple-action features depend on user cookies and private interfaces. Handling real account login in a third-party webpage carries a **credential leakage risk**, and Bilibili's risk control may block login requests originating from data-center IPs. When publicly deployed, this project **should not ask users to enter their Bilibili password**; feasible implementations for related features are still under evaluation.
- **Interface stability**: Bilibili's Web APIs employ signature mechanisms (such as WBI signing) and risk-control policies, and interfaces may change at any time. The project requires ongoing maintenance to keep up with these changes.
- **Compliance**: The project should comply with Bilibili's Terms of Service and applicable laws and regulations, and must not provide content that infringes copyright or bypasses paywalls. The boundaries of the download feature need to be carefully defined.
- **Current state**: As noted above, the repository does not yet contain a complete implementation. Any attempt to run the project's code should be regarded as development debugging, not as a usable product.

## Donate

If you find this project useful — especially for keeping Bilibili accessible on older browsers and low-end devices — you can buy the maintainer a coffee. Every donation helps keep the project alive.

[![GitHub Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-%23EA4AAA?style=for-the-badge&logo=github-sponsors&logoColor=white)](https://github.com/sponsors/AndyYang12)

> Donations are voluntary and non-refundable. They support maintenance, not a commercial service.

## Contributing and Feedback

Anyone interested in a lightweight Bilibili client is welcome to offer suggestions or join the discussion. If you wish to contribute code, please first open an Issue to explain your idea so that efforts can be coordinated.

## License

This project is licensed under the **GNU Affero General Public License v3.0 or later** (AGPL-3.0-or-later).

**Why AGPL?** This project's core value is its single-file full-stack architecture that adapts Bilibili for older browsers and low-end devices. AGPL's network-service-as-distribution clause ensures that if someone deploys a modified version as a public web service, they must offer the source code to their users — keeping improvements in the open. See [LICENSE](./LICENSE) for the full text.


## Acknowledgements

This branch keeps the full-featured build for platforms that allow server-side proxying (Render, Netlify, or a self-hosted VPS). It is **not** the build intended for shared Plesk hosting.

- [SocialSisterYi/bilibili-API-collect](https://github.com/SocialSisterYi/bilibili-API-collect) — community documentation of Bilibili's web APIs, WBI signing, and cookie conventions.
- PeanutDL — fallback source of direct MP4 URLs when Bilibili's `playurl` API refuses a request.
- Bilibili — for the public web APIs this client consumes.
- Everyone who reported issues and tested the client on low-end devices.
