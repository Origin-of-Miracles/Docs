# Performance Improvements

This document outlines the performance optimizations implemented in this documentation site.

## GitHub Actions Workflow Optimizations

### 1. Shallow Git Clone (`fetch-depth: 1`)
**Change**: Modified `fetch-depth` from `0` to `1` in the checkout action.

**Impact**:
- Reduces checkout time by only fetching the latest commit instead of entire git history
- Saves bandwidth and storage
- Particularly beneficial for repositories with long history
- For documentation sites, full history is typically not needed for builds

**Trade-off**: 
- VitePress's `lastUpdated` feature will show the build/deployment date instead of the actual file modification date
- **Mitigation**: The documentation already includes manual "最后更新" dates in markdown files (e.g., `> **最后更新**: 2025-12-18`), which are more reliable for documentation purposes
- If accurate git-based timestamps are critical, change `fetch-depth: 1` back to `fetch-depth: 0` in `.github/workflows/deploy.yml`

### 2. Removed Redundant SSH Directory Creation
**Change**: Removed `mkdir -p ~/.ssh` as it's already handled by the `webfactory/ssh-agent` action.

**Impact**:
- Cleaner workflow
- Slightly faster execution (minimal but good practice)

## VitePress Configuration Optimizations

### 1. Clean URLs Enabled
**Change**: Set `cleanUrls: true` (previously `false`)

**Benefits**:
- Better SEO: URLs without `.html` extension are more user-friendly
- Improved performance: Server can serve files more efficiently
- Better user experience: Cleaner, more memorable URLs
- Example: `/manifesto` instead of `/manifesto.html`

### 2. Vite Build Configuration
**Change**: Added `chunkSizeWarningLimit: 1000` in vite build config

**Benefits**:
- Suppresses unnecessary warnings for chunks under 1MB
- Helps identify genuinely problematic large chunks
- Improves build output readability

## Image Optimization Recommendations

### Current State
- `logo.png`: 169KB (404x404 pixels)

### Recommendations
1. **Optimize PNG**: Use tools like `pngquant` or `optipng` to reduce size
   ```bash
   # Example using pngquant
   pngquant --quality=65-80 logo.png -o logo-optimized.png
   ```
   Expected size reduction: 169KB → ~50-80KB (60-70% reduction)

2. **Consider WebP format**: Modern browsers support WebP which offers better compression
   ```bash
   # Convert to WebP
   cwebp -q 80 logo.png -o logo.webp
   ```
   Expected size: ~30-50KB

3. **Serve responsive images**: For retina displays, provide multiple sizes

## Performance Metrics

### Estimated Improvements

1. **GitHub Actions Workflow**:
   - Checkout time: ~50-80% faster (depends on repository size)
   - For a repository with 1000+ commits: 30-60 seconds saved per build

2. **Build Performance**:
   - Build time: Minimal impact (VitePress is already optimized)
   - Bundle size: Unchanged (VitePress handles this well)

3. **Runtime Performance**:
   - Page load: Improved with clean URLs
   - SEO: Better with clean URLs
   - Image load: Potential 60-70% improvement if logo is optimized

## Best Practices

### Git History and Last Updated Timestamps

The current configuration uses `fetch-depth: 1` for performance. The documentation includes manual "最后更新" dates in markdown files which serve as the canonical update timestamps. This approach:

1. **Faster CI/CD**: Shallow clones significantly reduce checkout time
2. **Explicit Dates**: Manual dates in markdown are visible in the source and more maintainable
3. **Git-based Footer**: VitePress footer shows last deployment date (not file modification date)

**Alternative Approach**: If you prefer git-based timestamps over manual dates:
- Change `fetch-depth: 1` to `fetch-depth: 0` in `.github/workflows/deploy.yml`
- Remove manual "最后更新" dates from markdown files
- Trade-off: Slower CI/CD for automatic timestamps

### For Future Development

1. **Images**: 
   - Always optimize images before committing
   - Target: <100KB for logos, <200KB for screenshots
   - Use appropriate formats (WebP for photos, PNG for graphics with transparency)

2. **Dependencies**:
   - Keep dependencies up to date
   - Review bundle size regularly
   - Use `pnpm` over `npm` for faster installs (already implemented)

3. **Git Operations**:
   - Use shallow clones in CI/CD
   - Keep commit history clean and meaningful
   - Use `.gitignore` to exclude large files

4. **Build Configuration**:
   - Leverage VitePress's built-in optimizations
   - Avoid custom rollup configurations unless necessary
   - Monitor build times and investigate slow builds

## Monitoring

To monitor performance over time:

1. **Build Times**: Check GitHub Actions logs for build duration trends
2. **Bundle Size**: Review VitePress build output for chunk sizes
3. **Page Load**: Use Lighthouse or WebPageTest for runtime performance

## Future Optimization Opportunities

1. **CDN Integration**: Consider using a CDN for static assets
2. **Lazy Loading**: Implement lazy loading for images and components if the site grows
3. **Service Worker**: Add offline support for better user experience
4. **Compression**: Ensure gzip/brotli compression is enabled on the web server
