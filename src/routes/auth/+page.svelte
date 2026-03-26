<script lang="ts">
	import DOMPurify from 'dompurify';
	import { marked } from 'marked';

	import { toast } from 'svelte-sonner';

	import { onMount, getContext, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	import { getBackendConfig } from '$lib/apis';
	import {
		ldapUserSignIn,
		getSessionUser,
		userSignIn,
		userSignUp,
		updateUserTimezone
	} from '$lib/apis/auths';

	import { WEBUI_API_BASE_URL, WEBUI_BASE_URL } from '$lib/constants';
	import { WEBUI_NAME, config, user, socket } from '$lib/stores';

	import { generateInitialsImage, canvasPixelTest, getUserTimezone } from '$lib/utils';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import OnBoarding from '$lib/components/OnBoarding.svelte';
	import SensitiveInput from '$lib/components/common/SensitiveInput.svelte';
	import { redirect } from '@sveltejs/kit';

	const i18n = getContext('i18n');

	let loaded = false;

	let mode = $config?.features.enable_ldap ? 'ldap' : 'signin';

	let form = null;

	let name = '';
	let email = '';
	let password = '';
	let confirmPassword = '';

	let ldapUsername = '';

	const setSessionUser = async (sessionUser, redirectPath: string | null = null) => {
		if (sessionUser) {
			console.log(sessionUser);
			toast.success($i18n.t(`You're now logged in.`));
			if (sessionUser.token) {
				localStorage.token = sessionUser.token;
			}
			$socket.emit('user-join', { auth: { token: sessionUser.token } });
			await user.set(sessionUser);
			await config.set(await getBackendConfig());

			const timezone = getUserTimezone();
			if (sessionUser.token && timezone) {
				updateUserTimezone(sessionUser.token, timezone);
			}

			if (!redirectPath) {
				redirectPath = $page.url.searchParams.get('redirect') || '/';
			}

			goto(redirectPath);
			localStorage.removeItem('redirectPath');
		}
	};

	const signInHandler = async () => {
		const sessionUser = await userSignIn(email, password).catch((error) => {
			toast.error(`${error}`);
			return null;
		});

		await setSessionUser(sessionUser);
	};

	const signUpHandler = async () => {
		if ($config?.features?.enable_signup_password_confirmation) {
			if (password !== confirmPassword) {
				toast.error($i18n.t('Passwords do not match.'));
				return;
			}
		}

		const sessionUser = await userSignUp(name, email, password, generateInitialsImage(name)).catch(
			(error) => {
				toast.error(`${error}`);
				return null;
			}
		);

		await setSessionUser(sessionUser);
	};

	const ldapSignInHandler = async () => {
		const sessionUser = await ldapUserSignIn(ldapUsername, password).catch((error) => {
			toast.error(`${error}`);
			return null;
		});
		await setSessionUser(sessionUser);
	};

	const submitHandler = async () => {
		if (mode === 'ldap') {
			await ldapSignInHandler();
		} else if (mode === 'signin') {
			await signInHandler();
		} else {
			await signUpHandler();
		}
	};

	const oauthCallbackHandler = async () => {
		function getCookie(name) {
			const match = document.cookie.match(
				new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)')
			);
			return match ? decodeURIComponent(match[1]) : null;
		}

		const token = getCookie('token');
		if (!token) return;

		const sessionUser = await getSessionUser(token).catch((error) => {
			toast.error(`${error}`);
			return null;
		});

		if (!sessionUser) return;

		localStorage.token = token;
		await setSessionUser(sessionUser, localStorage.getItem('redirectPath') || null);
	};

	let onboarding = false;

	async function setLogoImage() {
		await tick();
		const logo = document.getElementById('logo');
		if (logo) {
			const isDarkMode = document.documentElement.classList.contains('dark');
			if (isDarkMode) {
				const darkImage = new Image();
				darkImage.src = `${WEBUI_BASE_URL}/static/favicon-dark.png`;
				darkImage.onload = () => {
					logo.src = `${WEBUI_BASE_URL}/static/favicon-dark.png`;
					logo.style.filter = '';
				};
				darkImage.onerror = () => {
					logo.style.filter = 'invert(1)';
				};
			}
		}
	}

	onMount(async () => {
		const redirectPath = $page.url.searchParams.get('redirect');
		if ($user !== undefined) {
			goto(redirectPath || '/');
		} else {
			if (redirectPath) {
				localStorage.setItem('redirectPath', redirectPath);
			}
		}

		const error = $page.url.searchParams.get('error');
		if (error) {
			toast.error(error);
		}

		await oauthCallbackHandler();
		form = $page.url.searchParams.get('form');

		loaded = true;
		setLogoImage();

		if (($config?.features.auth_trusted_header ?? false) || $config?.features.auth === false) {
			await signInHandler();
		} else {
			onboarding = $config?.onboarding ?? false;
		}
	});
</script>

<svelte:head>
	<title>{`${$WEBUI_NAME}`}</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<style>
	:global(body) {
		margin: 0;
		background:
			radial-gradient(circle at 20% 20%, rgba(239, 68, 68, 0.12), transparent 30%),
			radial-gradient(circle at 80% 30%, rgba(220, 38, 38, 0.08), transparent 28%),
			linear-gradient(135deg, #050507 0%, #0b0b10 45%, #060608 100%);
		color: #f5f5f5;
		font-family: 'Inter', sans-serif;
	}

	:global(*) {
		box-sizing: border-box;
	}

	.auth-page {
		min-height: 100vh;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 32px 16px;
		overflow: hidden;
	}

	.grid-bg {
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
			linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
		background-size: 44px 44px;
		mask-image: radial-gradient(circle at center, black 35%, transparent 88%);
		opacity: 0.5;
		pointer-events: none;
	}

	.radial-glow {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(circle at center, rgba(220, 38, 38, 0.15) 0%, transparent 42%),
			radial-gradient(circle at center, rgba(255, 255, 255, 0.03) 0%, transparent 60%);
		pointer-events: none;
	}

	.scanlines {
		position: absolute;
		inset: 0;
		background: repeating-linear-gradient(
			to bottom,
			rgba(255, 255, 255, 0.01) 0px,
			rgba(255, 255, 255, 0.01) 1px,
			transparent 2px,
			transparent 4px
		);
		opacity: 0.22;
		pointer-events: none;
	}

	.auth-shell {
		position: relative;
		z-index: 2;
		width: 100%;
		max-width: 1080px;
		display: grid;
		grid-template-columns: 1.08fr 0.92fr;
		border-radius: 28px;
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(9, 9, 12, 0.72);
		backdrop-filter: blur(24px);
		box-shadow:
			0 24px 80px rgba(0, 0, 0, 0.55),
			0 0 0 1px rgba(255, 255, 255, 0.03) inset,
			0 0 80px rgba(220, 38, 38, 0.08);
		animation: shellIn 0.45s ease-out;
	}

	@keyframes shellIn {
		from {
			opacity: 0;
			transform: translateY(14px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	.left-panel {
		position: relative;
		padding: 42px 38px;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01)),
			linear-gradient(160deg, rgba(127, 29, 29, 0.18), rgba(10, 10, 12, 0.08));
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		min-height: 680px;
	}

	.left-panel::after {
		content: '';
		position: absolute;
		right: 0;
		top: 24px;
		bottom: 24px;
		width: 1px;
		background: linear-gradient(
			to bottom,
			transparent,
			rgba(255, 255, 255, 0.08),
			transparent
		);
	}

	.left-top {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.logo-chip {
		width: 64px;
		height: 64px;
		border-radius: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid rgba(239, 68, 68, 0.28);
		background: linear-gradient(135deg, rgba(220, 38, 38, 0.22), rgba(255, 255, 255, 0.04));
		box-shadow: 0 10px 32px rgba(220, 38, 38, 0.18);
		overflow: hidden;
	}

	.logo-chip img {
		width: 40px;
		height: 40px;
		border-radius: 999px;
	}

	.left-brand h1 {
		margin: 0;
		font-size: 1.15rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		color: #fafafa;
	}

	.left-brand p {
		margin: 4px 0 0;
		font-size: 0.8rem;
		color: #a1a1aa;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.hero-copy {
		max-width: 470px;
	}

	.hero-badge {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border-radius: 999px;
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.18);
		font-size: 0.74rem;
		font-weight: 700;
		color: #f87171;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		margin-bottom: 18px;
	}

	.hero-title {
		margin: 0;
		font-size: clamp(2rem, 3vw, 3.4rem);
		line-height: 1.02;
		font-weight: 800;
		letter-spacing: -0.03em;
		color: #fafafa;
	}

	.hero-title span {
		color: #f87171;
		text-shadow: 0 0 28px rgba(239, 68, 68, 0.18);
	}

	.hero-desc {
		margin: 18px 0 0;
		max-width: 430px;
		font-size: 0.98rem;
		line-height: 1.75;
		color: #b4b4bc;
	}

	.info-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 14px;
		margin-top: 28px;
	}

	.info-card {
		padding: 14px 14px 12px;
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.06);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
	}

	.info-card strong {
		display: block;
		font-size: 0.76rem;
		font-weight: 800;
		color: #f4f4f5;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		margin-bottom: 6px;
	}

	.info-card span {
		font-size: 0.84rem;
		line-height: 1.5;
		color: #a1a1aa;
	}

	.left-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding-top: 18px;
		margin-top: 24px;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		font-size: 0.82rem;
		color: #71717a;
	}

	.right-panel {
		padding: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.01)),
			radial-gradient(circle at top center, rgba(220, 38, 38, 0.08), transparent 44%);
	}

	.auth-card {
		width: 100%;
		max-width: 420px;
		padding: 28px;
		border-radius: 24px;
		background: rgba(16, 16, 20, 0.84);
		border: 1px solid rgba(255, 255, 255, 0.08);
		box-shadow:
			0 18px 50px rgba(0, 0, 0, 0.35),
			0 0 0 1px rgba(255, 255, 255, 0.02) inset;
	}

	.card-header {
		margin-bottom: 22px;
	}

	.card-kicker {
		font-size: 0.72rem;
		font-weight: 700;
		color: #f87171;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		margin-bottom: 8px;
	}

	.card-title {
		margin: 0;
		font-size: 1.7rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: #fafafa;
	}

	.card-subtitle {
		margin: 8px 0 0;
		font-size: 0.93rem;
		line-height: 1.7;
		color: #a1a1aa;
	}

	.mode-tabs {
		display: flex;
		gap: 10px;
		margin-bottom: 18px;
	}

	.mode-tab {
		flex: 1;
		height: 44px;
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.02);
		color: #8b8b95;
		font-size: 0.82rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		cursor: pointer;
		transition: 0.2s ease;
	}

	.mode-tab.active {
		background: linear-gradient(135deg, rgba(239, 68, 68, 0.18), rgba(185, 28, 28, 0.16));
		color: #fff;
		border-color: rgba(239, 68, 68, 0.25);
		box-shadow: 0 8px 20px rgba(220, 38, 38, 0.14);
	}

	.field-group {
		margin-bottom: 15px;
	}

	.field-label {
		display: block;
		margin-bottom: 8px;
		font-size: 0.73rem;
		font-weight: 700;
		color: #b4b4bc;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.field-wrap {
		position: relative;
		display: flex;
		align-items: center;
	}

	.field-icon {
		position: absolute;
		left: 14px;
		top: 50%;
		transform: translateY(-50%);
		width: 17px;
		height: 17px;
		color: #666673;
		pointer-events: none;
		z-index: 2;
	}

	.field-input {
		width: 100%;
		height: 52px;
		padding: 0 16px 0 44px;
		border-radius: 14px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.04);
		color: #f4f4f5;
		font-size: 0.95rem;
		font-family: 'Inter', sans-serif;
		outline: none;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease,
			background 0.2s ease,
			transform 0.2s ease;
	}

	.field-input::placeholder {
		color: #666673;
	}

	.field-input:focus {
		border-color: rgba(239, 68, 68, 0.35);
		background: rgba(255, 255, 255, 0.06);
		box-shadow:
			0 0 0 4px rgba(239, 68, 68, 0.08),
			0 10px 30px rgba(220, 38, 38, 0.08);
	}

	:global(.field-wrap > div) {
		width: 100%;
		position: relative;
		min-width: 0;
		display: flex;
		align-items: center;
	}

	:global(.field-wrap input),
	:global(.field-wrap input[type="password"]),
	:global(.field-wrap input[type="text"]) {
		width: 100%;
		min-width: 0;
		height: 52px;
		padding: 0 44px 0 44px !important;
		border-radius: 14px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.04);
		color: #f4f4f5 !important;
		-webkit-text-fill-color: #f4f4f5 !important;
		caret-color: #ef4444;
		font-size: 0.95rem;
		font-family: 'Inter', sans-serif;
		outline: none;
		box-sizing: border-box;
		line-height: 52px;
	}

	:global(.field-wrap input::placeholder) {
		color: #666673 !important;
		-webkit-text-fill-color: #666673;
	}

	:global(.field-wrap input:focus) {
		border-color: rgba(239, 68, 68, 0.35);
		background: rgba(255, 255, 255, 0.06);
		box-shadow:
			0 0 0 4px rgba(239, 68, 68, 0.08),
			0 10px 30px rgba(220, 38, 38, 0.08);
	}

	:global(.field-wrap button) {
		position: absolute;
		right: 14px;
		top: 50%;
		transform: translateY(-50%);
		background: transparent;
		border: none;
		color: #8b8b95;
		cursor: pointer;
		padding: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		z-index: 3;
	}

	.submit-btn {
		width: 100%;
		height: 54px;
		border: none;
		border-radius: 16px;
		margin-top: 8px;
		background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
		color: #fff;
		font-size: 0.92rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		box-shadow:
			0 14px 34px rgba(220, 38, 38, 0.28),
			inset 0 1px 0 rgba(255, 255, 255, 0.12);
		transition: 0.22s ease;
	}

	.submit-btn:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow:
			0 18px 42px rgba(220, 38, 38, 0.38),
			inset 0 1px 0 rgba(255, 255, 255, 0.16);
	}

	.submit-btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.submit-btn svg {
		width: 18px;
		height: 18px;
	}

	.oauth-divider {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 20px 0 14px;
	}

	.oauth-divider hr {
		flex: 1;
		border: none;
		height: 1px;
		background: rgba(255, 255, 255, 0.08);
	}

	.oauth-divider span {
		font-size: 0.74rem;
		color: #71717a;
		font-weight: 700;
		letter-spacing: 0.08em;
	}

	.oauth-btn {
		width: 100%;
		min-height: 48px;
		padding: 12px 14px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		border-radius: 14px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.03);
		color: #dddde3;
		font-size: 0.88rem;
		font-weight: 600;
		cursor: pointer;
		margin-bottom: 10px;
		transition: 0.2s ease;
	}

	.oauth-btn:hover {
		background: rgba(255, 255, 255, 0.06);
		border-color: rgba(255, 255, 255, 0.14);
	}

	.oauth-btn svg {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
	}

	.ldap-toggle,
	.marked,
	.toggle-mode {
		margin-top: 16px;
		text-align: center;
	}

	.ldap-toggle button,
	.toggle-mode button,
	.toggle-mode a {
		background: transparent;
		border: none;
		padding: 0;
		font-size: 0.82rem;
		font-weight: 600;
		color: #9ca3af;
		cursor: pointer;
	}

	.ldap-toggle button:hover,
	.toggle-mode button:hover,
	.toggle-mode a:hover {
		color: #f3f4f6;
	}

	.signing-in {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		color: #f4f4f5;
		font-size: 1rem;
		font-weight: 700;
	}

	.marked {
		font-size: 0.78rem;
		line-height: 1.7;
		color: #8b8b95;
	}

	.mobile-brand {
		display: none;
		margin-bottom: 18px;
	}

	.mobile-brand-top {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 14px;
	}

	.mobile-brand h2 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 800;
		color: #fafafa;
	}

	.mobile-brand p {
		margin: 4px 0 0;
		font-size: 0.78rem;
		color: #8b8b95;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	@media (max-width: 920px) {
		.auth-shell {
			grid-template-columns: 1fr;
			max-width: 520px;
		}

		.left-panel {
			display: none;
		}

		.right-panel {
			padding: 20px;
		}

		.auth-card {
			max-width: 100%;
			padding: 24px;
		}

		.mobile-brand {
			display: block;
		}
	}

	@media (max-width: 560px) {
		.auth-page {
			padding: 14px;
		}

		.right-panel {
			padding: 14px;
		}

		.auth-card {
			padding: 20px 16px;
			border-radius: 20px;
		}

		.card-title {
			font-size: 1.4rem;
		}
	}
</style>

<OnBoarding
	bind:show={onboarding}
	getStartedHandler={() => {
		onboarding = false;
		mode = $config?.features.enable_ldap ? 'ldap' : 'signup';
	}}
/>

<div class="auth-page" id="auth-page">
	<div class="grid-bg"></div>
	<div class="radial-glow"></div>
	<div class="scanlines"></div>

	<div class="w-full absolute top-0 left-0 right-0 h-8 drag-region"></div>

	{#if loaded}
		<div class="auth-shell">
			<div class="left-panel">
				<div class="left-top">
					<div class="logo-chip">
						<img
							id="logo"
							crossorigin="anonymous"
							src="{WEBUI_BASE_URL}/static/favicon.png"
							alt="{$WEBUI_NAME}"
						/>
					</div>
					<div class="left-brand">
						<h1>{$WEBUI_NAME}</h1>
						<p>Secure AI Workspace</p>
					</div>
				</div>

				<div class="hero-copy">
					<div class="hero-badge">Secure Access Layer</div>
					<h2 class="hero-title">
						A smarter gateway to your <span>AI workspace</span>
					</h2>
					<p class="hero-desc">
						Access conversations, models, and internal tools through a cleaner,
						more secure authentication experience designed for focused teams.
					</p>

					<div class="info-grid">
						<div class="info-card">
							<strong>Protected</strong>
							<span>Controlled access for authorized users and internal environments.</span>
						</div>
						<div class="info-card">
							<strong>Fast</strong>
							<span>Minimal friction sign-in flow with support for email, LDAP, and SSO.</span>
						</div>
						<div class="info-card">
							<strong>Unified</strong>
							<span>One modern entry point to Open WebUI and your integrated services.</span>
						</div>
					</div>
				</div>

				<div class="left-footer">
					<span>System Version 2.0.0</span>
					<span>{$WEBUI_NAME} · Secure Portal</span>
				</div>
			</div>

			<div class="right-panel">
				<div class="auth-card">
					{#if ($config?.features.auth_trusted_header ?? false) || $config?.features.auth === false}
						<div class="signing-in">
							<span>{$i18n.t('Signing in to {{WEBUI_NAME}}', { WEBUI_NAME: $WEBUI_NAME })}</span>
							<Spinner className="size-5" />
						</div>
					{:else}
						<div class="mobile-brand">
							<div class="mobile-brand-top">
								<div class="logo-chip" style="width:56px;height:56px;">
									<img
										crossorigin="anonymous"
										src="{WEBUI_BASE_URL}/static/favicon.png"
										alt="{$WEBUI_NAME}"
									/>
								</div>
								<div>
									<h2>{$WEBUI_NAME}</h2>
									<p>Secure AI Workspace</p>
								</div>
							</div>
						</div>

						<div class="card-header">
							<div class="card-kicker">Authorized Access</div>
							<h2 class="card-title">
								{mode === 'signup' ? $i18n.t('Create Account') : $i18n.t('Welcome Back')}
							</h2>
							<p class="card-subtitle">
								{#if mode === 'signup'}
									{$i18n.t('Set up your secure account to access the platform.')}
								{:else if mode === 'ldap'}
									{$i18n.t('Authenticate with your organization credentials.')}
								{:else}
									{$i18n.t('Sign in to continue to your workspace.')}
								{/if}
							</p>
						</div>

						{#if $config?.features.enable_signup && !($config?.onboarding ?? false) && !$config?.features.enable_ldap}
							<div class="mode-tabs">
								<button
									type="button"
									class="mode-tab {mode === 'signin' ? 'active' : ''}"
									on:click={() => (mode = 'signin')}
								>
									{$i18n.t('SIGN IN')}
								</button>
								<button
									type="button"
									class="mode-tab {mode === 'signup' ? 'active' : ''}"
									on:click={() => (mode = 'signup')}
								>
									{$i18n.t('SIGN UP')}
								</button>
							</div>
						{/if}

						{#if $config?.features.enable_login_form || $config?.features.enable_ldap || form}
							<form
								on:submit={(e) => {
									e.preventDefault();
									submitHandler();
								}}
							>
								{#if mode === 'signup'}
									<div class="field-group">
										<label for="name" class="field-label">{$i18n.t('Full Name')}</label>
										<div class="field-wrap">
											<svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
												<circle cx="12" cy="7" r="4" />
											</svg>
											<input
												bind:value={name}
												type="text"
												id="name"
												class="field-input"
												autocomplete="name"
												placeholder={$i18n.t('Enter your full name')}
												required
											/>
										</div>
									</div>
								{/if}

								{#if mode === 'ldap'}
									<div class="field-group">
										<label for="username" class="field-label">{$i18n.t('Username')}</label>
										<div class="field-wrap">
											<svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
												<circle cx="12" cy="7" r="4" />
											</svg>
											<input
												bind:value={ldapUsername}
												type="text"
												id="username"
												name="username"
												class="field-input"
												autocomplete="username"
												placeholder={$i18n.t('Enter your username')}
												required
											/>
										</div>
									</div>
								{:else}
									<div class="field-group">
										<label for="email" class="field-label">{$i18n.t('Email')}</label>
										<div class="field-wrap">
											<svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
												<polyline points="22,6 12,13 2,6" />
											</svg>
											<input
												bind:value={email}
												type="email"
												id="email"
												name="email"
												class="field-input"
												autocomplete="email"
												placeholder={$i18n.t('Enter your email')}
												required
											/>
										</div>
									</div>
								{/if}

								<div class="field-group">
									<label for="password" class="field-label">{$i18n.t('Password')}</label>
									<div class="field-wrap">
										<svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
											<path d="M7 11V7a5 5 0 0 1 10 0v4" />
										</svg>
										<SensitiveInput
											bind:value={password}
											type="password"
											id="password"
											placeholder={$i18n.t('Enter your password')}
											autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
											name="password"
											required
										/>
									</div>
								</div>

								{#if mode === 'signup' && $config?.features?.enable_signup_password_confirmation}
									<div class="field-group">
										<label for="confirm-password" class="field-label">{$i18n.t('Confirm Password')}</label>
										<div class="field-wrap">
											<svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
												<path d="M7 11V7a5 5 0 0 1 10 0v4" />
											</svg>
											<SensitiveInput
												bind:value={confirmPassword}
												type="password"
												id="confirm-password"
												placeholder={$i18n.t('Confirm your password')}
												autocomplete="new-password"
												name="confirm-password"
												required
											/>
										</div>
									</div>
								{/if}

								<button class="submit-btn" type="submit">
									<span>
										{#if mode === 'ldap'}
											{$i18n.t('Authenticate')}
										{:else if mode === 'signin'}
											{$i18n.t('Sign In')}
										{:else if $config?.onboarding ?? false}
											{$i18n.t('Create Admin Account')}
										{:else}
											{$i18n.t('Create Account')}
										{/if}
									</span>
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
										<path d="M5 12h14M12 5l7 7-7 7" />
									</svg>
								</button>
							</form>
						{/if}

						{#if Object.keys($config?.oauth?.providers ?? {}).length > 0}
							<div class="oauth-divider">
								<hr />
								{#if $config?.features.enable_login_form || $config?.features.enable_ldap || form}
									<span>{$i18n.t('OR')}</span>
								{/if}
								<hr />
							</div>

							<div>
								{#if $config?.oauth?.providers?.google}
									<button class="oauth-btn" on:click={() => { window.location.href = `${WEBUI_BASE_URL}/oauth/google/login`; }}>
										<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden="true">
											<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
											<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
											<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
											<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
										</svg>
										{$i18n.t('Continue with {{provider}}', { provider: 'Google' })}
									</button>
								{/if}

								{#if $config?.oauth?.providers?.microsoft}
									<button class="oauth-btn" on:click={() => { window.location.href = `${WEBUI_BASE_URL}/oauth/microsoft/login`; }}>
										<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21" aria-hidden="true">
											<rect x="1" y="1" width="9" height="9" fill="#f25022"/>
											<rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
											<rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
											<rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
										</svg>
										{$i18n.t('Continue with {{provider}}', { provider: 'Microsoft' })}
									</button>
								{/if}

								{#if $config?.oauth?.providers?.github}
									<button class="oauth-btn" on:click={() => { window.location.href = `${WEBUI_BASE_URL}/oauth/github/login`; }}>
										<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
											<path fill="currentColor" d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.92 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57C20.565 21.795 24 17.31 24 12c0-6.63-5.37-12-12-12z"/>
										</svg>
										{$i18n.t('Continue with {{provider}}', { provider: 'GitHub' })}
									</button>
								{/if}

								{#if $config?.oauth?.providers?.oidc}
									<button class="oauth-btn" on:click={() => { window.location.href = `${WEBUI_BASE_URL}/oauth/oidc/login`; }}>
										<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
											<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z"/>
										</svg>
										{$i18n.t('Continue with {{provider}}', { provider: $config?.oauth?.providers?.oidc ?? 'SSO' })}
									</button>
								{/if}

								{#if $config?.oauth?.providers?.feishu}
									<button class="oauth-btn" on:click={() => { window.location.href = `${WEBUI_BASE_URL}/oauth/feishu/login`; }}>
										{$i18n.t('Continue with {{provider}}', { provider: 'Feishu' })}
									</button>
								{/if}
							</div>
						{/if}

						{#if $config?.features.enable_ldap && $config?.features.enable_login_form}
							<div class="ldap-toggle">
								<button
									type="button"
									on:click={() => {
										if (mode === 'ldap') mode = ($config?.onboarding ?? false) ? 'signup' : 'signin';
										else mode = 'ldap';
									}}
								>
									{mode === 'ldap' ? $i18n.t('Continue with Email') : $i18n.t('Continue with LDAP')}
								</button>
							</div>
						{/if}

						{#if $config?.metadata?.login_footer}
							<div class="marked">
								{@html DOMPurify.sanitize(marked($config?.metadata?.login_footer))}
							</div>
						{/if}
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>