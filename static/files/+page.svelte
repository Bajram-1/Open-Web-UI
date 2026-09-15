<script>
	let email = '';
	let password = '';
	let showPassword = false;
	let submitted = false;

	function handleSubmit(event) {
		event.preventDefault();
		submitted = true;
		// UI only — wire this up to your real auth call.
		console.log('Sign in attempt', { email });
	}
</script>

<svelte:head>
	<title>Sign in — Dossier access</title>
</svelte:head>

<div class="screen">
	<div class="panel hero">
		<div class="hero-top">
			<div class="eyebrow">
				<span class="eyebrow-line"></span>
				<span class="eyebrow-text">INTELLIGENCE ACCESS</span>
			</div>
			<h1>Need to know.<br />Now granted.</h1>
			<p class="hero-copy">Enter a compartmented workspace where signals become certainty.</p>
		</div>

		<div class="hero-image-wrap">
			<img
				class="hero-image"
				src="/static/hero-operatives.png"
				alt="Two armored intelligence operatives"
			/>
			<div class="hero-tag">NX-01 / ONLINE</div>
		</div>

		<div class="hero-badges">
			<span>○ 256-bit secure</span>
			<span>○ compartmented access</span>
		</div>
	</div>

	<div class="panel form-panel">
		<div class="stamp">CLASSIFIED</div>

		<span class="eyebrow-text small">DOSSIER ACCESS</span>
		<h2>Welcome back</h2>
		<p class="form-copy">Continue to your briefing room.</p>

		<form on:submit={handleSubmit}>
			<label for="email">Field agent email</label>
			<input
				id="email"
				type="email"
				placeholder="you@command.gov"
				bind:value={email}
				required
			/>

			<div class="row">
				<label for="password">Password</label>
				<button type="button" class="link-btn">Forgot password?</button>
			</div>
			<div class="password-field">
				<input
					id="password"
					type={showPassword ? 'text' : 'password'}
					placeholder="••••••••"
					bind:value={password}
					required
				/>
				<button
					type="button"
					class="show-btn"
					on:click={() => (showPassword = !showPassword)}
				>
					{showPassword ? 'Hide' : 'Show'}
				</button>
			</div>

			<button type="submit" class="submit-btn">Sign in</button>

			{#if submitted}
				<p class="status">Checked in — this page is UI only, no auth is wired up.</p>
			{/if}
		</form>

		<div class="divider">
			<span></span>
			<p>OR CONTINUE WITH</p>
			<span></span>
		</div>

		<div class="providers">
			<button type="button">Google</button>
			<button type="button">Apple</button>
			<button type="button">SSO</button>
		</div>

		<p class="footer-link">New agent? <span>Request clearance</span></p>

		<div class="file-ref">
			<span>FILE REF: NX-01-██████</span>
			<span>EYES ONLY</span>
		</div>
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		background: #05070d;
	}

	.screen {
		display: flex;
		min-height: 100vh;
		font-family: 'Inter', system-ui, sans-serif;
	}

	.panel {
		flex: 1;
		padding: 3rem 3.5rem;
		position: relative;
		box-sizing: border-box;
	}

	/* --- Hero panel --- */
	.hero {
		background: #0d1220;
		border-right: 1px solid #1c2440;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}

	.eyebrow {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 1.5rem;
	}

	.eyebrow-line {
		width: 18px;
		height: 1px;
		background: #b5453f;
	}

	.eyebrow-text {
		font-family: 'JetBrains Mono', monospace;
		font-size: 11px;
		letter-spacing: 2px;
		color: #8b96b8;
	}

	.eyebrow-text.small {
		font-size: 10px;
	}

	h1 {
		font-family: Georgia, 'Times New Roman', serif;
		color: #e4e7f0;
		font-size: 42px;
		line-height: 1.15;
		margin: 0 0 14px;
		font-weight: 400;
	}

	.hero-copy {
		color: #6b7794;
		font-size: 14px;
		line-height: 1.6;
		max-width: 340px;
		margin: 0;
	}

	.hero-image-wrap {
		position: relative;
		display: flex;
		justify-content: center;
		margin: 1.5rem 0;
	}

	.hero-image {
		max-width: 100%;
		max-height: 420px;
		object-fit: contain;
		filter: drop-shadow(0 0 40px rgba(0, 0, 0, 0.5));
	}

	.hero-tag {
		position: absolute;
		bottom: 8px;
		left: 8px;
		font-family: 'JetBrains Mono', monospace;
		font-size: 10px;
		letter-spacing: 1px;
		color: #5a6480;
	}

	.hero-badges {
		display: flex;
		gap: 20px;
		font-family: 'JetBrains Mono', monospace;
		font-size: 11px;
		color: #5a6480;
	}

	/* --- Form panel --- */
	.form-panel {
		background: #12182a;
		display: flex;
		flex-direction: column;
		justify-content: center;
		max-width: 440px;
	}

	.stamp {
		position: absolute;
		top: 28px;
		right: -34px;
		background: #b5453f;
		color: #f6e2e0;
		font-family: 'JetBrains Mono', monospace;
		font-size: 10px;
		letter-spacing: 1px;
		padding: 3px 44px;
		transform: rotate(45deg);
	}

	h2 {
		font-family: Georgia, 'Times New Roman', serif;
		color: #cbd0dc;
		font-size: 30px;
		margin: 10px 0 4px;
		font-weight: 400;
	}

	.form-copy {
		color: #6b7794;
		font-size: 14px;
		margin: 0 0 1.75rem;
	}

	form {
		display: flex;
		flex-direction: column;
	}

	label {
		font-size: 12px;
		color: #6b7794;
		margin-bottom: 6px;
	}

	.row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}

	input {
		width: 100%;
		box-sizing: border-box;
		background: #182036;
		border: 1px solid #26304d;
		color: #cbd0dc;
		height: 42px;
		padding: 0 12px;
		border-radius: 6px;
		font-size: 14px;
		margin-bottom: 16px;
	}

	input:focus {
		outline: none;
		border-color: #b5453f;
	}

	.password-field {
		position: relative;
	}

	.password-field input {
		padding-right: 56px;
	}

	.show-btn {
		position: absolute;
		right: 12px;
		top: 10px;
		background: none;
		border: none;
		color: #7d92c9;
		font-size: 12px;
		cursor: pointer;
	}

	.link-btn {
		background: none;
		border: none;
		color: #7d92c9;
		font-size: 12px;
		cursor: pointer;
		padding: 0;
	}

	.submit-btn {
		width: 100%;
		height: 44px;
		background: #b5453f;
		color: #f6e2e0;
		border: none;
		font-weight: 500;
		font-size: 14px;
		border-radius: 6px;
		cursor: pointer;
		margin-top: 4px;
	}

	.submit-btn:hover {
		background: #a03a34;
	}

	.status {
		font-size: 12px;
		color: #7d92c9;
		margin-top: 10px;
	}

	.divider {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 1.5rem 0;
	}

	.divider span:not(p) {
		flex: 1;
		height: 1px;
		background: #26304d;
	}

	.divider p {
		font-family: 'JetBrains Mono', monospace;
		font-size: 10px;
		letter-spacing: 1px;
		color: #5a6480;
		margin: 0;
	}

	.providers {
		display: flex;
		gap: 10px;
	}

	.providers button {
		flex: 1;
		height: 38px;
		background: #182036;
		border: 1px solid #26304d;
		color: #cbd0dc;
		font-size: 12px;
		border-radius: 6px;
		cursor: pointer;
	}

	.providers button:hover {
		border-color: #3a4570;
	}

	.footer-link {
		text-align: center;
		font-size: 13px;
		color: #6b7794;
		margin-top: 1.5rem;
	}

	.footer-link span {
		color: #cbd0dc;
		font-weight: 500;
	}

	.file-ref {
		margin-top: 20px;
		font-family: 'JetBrains Mono', monospace;
		font-size: 10px;
		color: #3f4a68;
		display: flex;
		justify-content: space-between;
	}

	@media (max-width: 900px) {
		.screen {
			flex-direction: column;
		}

		.panel {
			padding: 2rem;
			max-width: none;
		}

		.hero-image {
			max-height: 280px;
		}
	}
</style>
