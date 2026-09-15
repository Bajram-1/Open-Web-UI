<script lang="ts">
	import DOMPurify from 'dompurify';
	import { marked } from 'marked';

	import { toast } from 'svelte-sonner';

	import { onMount, getContext, tick } from 'svelte';
	import type { Writable } from 'svelte/store';
	import type { i18n as I18n } from 'i18next';
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
	import { changeLanguage } from '$lib/i18n';
	import { WEBUI_NAME, config, user, socket } from '$lib/stores';

	import { generateInitialsImage, canvasPixelTest, getUserTimezone } from '$lib/utils';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import OnBoarding from '$lib/components/OnBoarding.svelte';
	import SensitiveInput from '$lib/components/common/SensitiveInput.svelte';
	type RuntimeConfig = {
		features: {
			auth: boolean;
			auth_trusted_header: boolean;
			enable_signup: boolean;
			enable_login_form: boolean;
			enable_ldap?: boolean;
			enable_signup_password_confirmation?: boolean;
		};
		onboarding?: boolean;
		oauth?: {
			providers?: Record<string, string | boolean | undefined>;
		};
		metadata?: {
			login_footer?: string;
		};
	};

	type SessionUser = NonNullable<Awaited<ReturnType<typeof userSignIn>>>;

	const i18n = getContext<Writable<I18n>>('i18n');
	$: runtimeConfig = $config as unknown as RuntimeConfig | undefined;

	let loaded = false;

	let mode = runtimeConfig?.features.enable_ldap ? 'ldap' : 'signin';

	let form: string | null = null;

	let name = '';
	let email = '';
	let password = '';
	let confirmPassword = '';

	let ldapUsername = '';
	let isSubmitting = false;
	let authError = '';

	const getAlbanianAuthError = (error: unknown): string => {
		const message = `${error ?? ''}`.toLowerCase();

		if (message.includes('401') || message.includes('unauthorized') || message.includes('invalid')) {
			return 'Email-i ose fjalëkalimi nuk është i saktë.';
		}
		if (message.includes('429') || message.includes('too many')) {
			return 'Ka shumë përpjekje hyrjeje. Prisni pak dhe provoni përsëri.';
		}
		if (message.includes('fetch') || message.includes('network') || message.includes('connect')) {
			return 'Nuk u arrit lidhja me serverin. Kontrolloni lidhjen dhe provoni përsëri.';
		}

		return 'Hyrja nuk u krye. Verifikoni të dhënat dhe provoni përsëri.';
	};

	const reportAuthError = (error: unknown): void => {
		authError = getAlbanianAuthError(error);
		toast.error(authError);
	};

	const setSessionUser = async (
		sessionUser: SessionUser | null,
		redirectPath: string | null = null
	): Promise<void> => {
		if (sessionUser) {
			console.log(sessionUser);
			toast.success('Hyrja u krye me sukses.');
			if (sessionUser.token) {
				localStorage.token = sessionUser.token;
			}
			$socket?.emit('user-join', { auth: { token: sessionUser.token } });
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
			reportAuthError(error);
			return null;
		});

		await setSessionUser(sessionUser);
	};

	const signUpHandler = async () => {
		if (runtimeConfig?.features.enable_signup_password_confirmation) {
			if (password !== confirmPassword) {
				toast.error($i18n.t('Passwords do not match.'));
				return;
			}
		}

		const sessionUser = await userSignUp(name, email, password, generateInitialsImage(name)).catch(
			(error) => {
				reportAuthError(error);
				return null;
			}
		);

		await setSessionUser(sessionUser);
	};

	const ldapSignInHandler = async () => {
		const sessionUser = await ldapUserSignIn(ldapUsername, password).catch((error) => {
			reportAuthError(error);
			return null;
		});
		await setSessionUser(sessionUser);
	};

	const submitHandler = async () => {
		if (isSubmitting) return;
		authError = '';

		if (!password || (mode === 'ldap' ? !ldapUsername : !email)) {
			authError = 'Plotësoni të gjitha fushat e detyrueshme.';
			return;
		}

		isSubmitting = true;
		try {
			if (mode === 'ldap') {
				await ldapSignInHandler();
			} else if (mode === 'signin') {
				await signInHandler();
			} else {
				await signUpHandler();
			}
		} finally {
			isSubmitting = false;
		}
	};

	const oauthCallbackHandler = async () => {
		function getCookie(name: string): string | null {
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
		const logo = document.getElementById('logo') as HTMLImageElement | null;
		if (logo) {
			logo.src = `${WEBUI_BASE_URL}/ai-robot-cutout.png`;
			logo.style.filter = 'none';
		}
	}

	onMount(async () => {
		// The authentication experience for this deployment is Albanian.
		// Set it explicitly so an old browser/localStorage preference cannot
		// make the login page fall back to English.
		changeLanguage('sq-AL');

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

		if ((runtimeConfig?.features.auth_trusted_header ?? false) || runtimeConfig?.features.auth === false) {
			await signInHandler();
		} else {
			onboarding = runtimeConfig?.onboarding ?? false;
		}
	});
</script>

<svelte:head>
	<title>{`${$WEBUI_NAME}`}</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=inter:wght@400;500;600;700;800&family=jetbrains+mono:wght@400;500;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<OnBoarding
	bind:show={onboarding}
	getStartedHandler={() => {
		onboarding = false;
		mode = runtimeConfig?.features.enable_ldap ? 'ldap' : 'signup';
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
				<div class="official-ribbon" aria-hidden="true"><span></span></div>
				<div class="left-top">
					<div class="institutional-heading">
						<img
							src="{WEBUI_BASE_URL}/static/albanian-eagle-emblem.png"
							alt="Stema shqiptare"
							class="institutional-mark"
						/>
						<div>
							<span>MINISTRIA E MBROJTJES</span>
							<strong>FORCAT E ARMATOSURA TË REPUBLIKËS SË SHQIPËRISË</strong>
						</div>
					</div>
				<div class="left-brand">
					<div class="official-kicker">INTELIGJENCË ARTIFICIALE · QASJE E SIGURT</div>
					<h1>{$WEBUI_NAME}</h1>
					</div>
					<div class="robot-stage">
						<img
							id="logo"
							crossorigin="anonymous"
							src="{WEBUI_BASE_URL}/ai-robot-cutout.png"
							alt={$WEBUI_NAME}
							class="robot-cutout"
						/>
					</div>
					<p class="platform-description">Platformë e sigurt informimi dhe asistence për personelin e autorizuar</p>
					<div class="security-status"><span aria-hidden="true"></span>SISTEM AKTIV · LIDHJE E MBROJTUR</div>
				</div>
			</div>

			<div class="right-panel">
				<div class="auth-card">
					{#if (runtimeConfig?.features.auth_trusted_header ?? false) || runtimeConfig?.features.auth === false}
						<div class="signing-in">
							<span>{$i18n.t('Signing in to {{WEBUI_NAME}}', { WEBUI_NAME: $WEBUI_NAME })}</span>
							<Spinner className="size-5" />
						</div>
					{:else}
						<div class="mobile-brand">
							<div class="mobile-brand-top">
								<div class="logo-chip" style="width:140px;height:140px;">
									<img
										crossorigin="anonymous"
										src="{WEBUI_BASE_URL}/ai-robot-cutout.png"
										alt={$WEBUI_NAME}
										class="qendra-logo"
									/>
								</div>
								<div>
									<h2>{$WEBUI_NAME}</h2>
								</div>
							</div>
						</div>

						<div class="card-header">
							<div class="card-kicker">{$i18n.t('Authorized Access')}</div>
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

						{#if runtimeConfig?.features.enable_signup && !(runtimeConfig?.onboarding ?? false) && !runtimeConfig?.features.enable_ldap}
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

						{#if runtimeConfig?.features.enable_login_form || runtimeConfig?.features.enable_ldap || form}
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
											<svg
												class="field-icon"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
											>
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
											<svg
												class="field-icon"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
											>
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
											<svg
												class="field-icon"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
											>
												<path
													d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
												/>
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
										<svg
											class="field-icon"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
										>
											<rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
											<path d="M7 11V7a5 5 0 0 1 10 0v4" />
										</svg>
										<SensitiveInput
											bind:value={password}
											type="password"
											id="password"
											placeholder={$i18n.t('Enter your password')}
											autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
											required
										/>
									</div>
								</div>

								{#if mode === 'signup' && runtimeConfig?.features.enable_signup_password_confirmation}
									<div class="field-group">
										<label for="confirm-password" class="field-label"
											>{$i18n.t('Confirm Password')}</label
										>
										<div class="field-wrap">
											<svg
												class="field-icon"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
											>
												<rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
												<path d="M7 11V7a5 5 0 0 1 10 0v4" />
											</svg>
											<SensitiveInput
												bind:value={confirmPassword}
												type="password"
												id="confirm-password"
												placeholder={$i18n.t('Confirm your password')}
												autocomplete="new-password"
												required
											/>
										</div>
									</div>
								{/if}

								{#if authError}
									<div class="auth-error" role="alert" aria-live="polite">{authError}</div>
								{/if}

								<button
									class="submit-btn"
									type="submit"
									disabled={isSubmitting}
									aria-busy={isSubmitting}
								>
									<span>
										{#if isSubmitting}
											<span class="button-spinner" aria-hidden="true"></span>
											Duke u lidhur…
										{:else if mode === 'ldap'}
											{$i18n.t('Authenticate')}
										{:else if mode === 'signin'}
											{$i18n.t('Sign In')}
										{:else if runtimeConfig?.onboarding ?? false}
											{$i18n.t('Create Admin Account')}
										{:else}
											{$i18n.t('Create Account')}
										{/if}
									</span>
						<svg class:is-hidden={isSubmitting} class="submit-security-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
							<path d="M12 3l7 3v5c0 4.6-2.8 8-7 10-4.2-2-7-5.4-7-10V6l7-3zM9.25 12.1l1.8 1.8 3.9-4.15" />
						</svg>
								</button>
								<p class="authorized-note">
									<span aria-hidden="true">🔒</span>
									Vetëm për personel të autorizuar
								</p>
							</form>
						{/if}

						{#if Object.keys(runtimeConfig?.oauth?.providers ?? {}).length > 0}
							<div class="oauth-divider">
								<hr />
								{#if runtimeConfig?.features.enable_login_form || runtimeConfig?.features.enable_ldap || form}
									<span>{$i18n.t('OR')}</span>
								{/if}
								<hr />
							</div>

							<div>
								{#if runtimeConfig?.oauth?.providers?.google}
									<button
										class="oauth-btn"
										on:click={() => {
											window.location.href = `${WEBUI_BASE_URL}/oauth/google/login`;
										}}
									>
										<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden="true">
											<path
												fill="#EA4335"
												d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
											/>
											<path
												fill="#4285F4"
												d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
											/>
											<path
												fill="#FBBC05"
												d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
											/>
											<path
												fill="#34A853"
												d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
											/>
										</svg>
										{$i18n.t('Continue with {{provider}}', { provider: 'Google' })}
									</button>
								{/if}

								{#if runtimeConfig?.oauth?.providers?.microsoft}
									<button
										class="oauth-btn"
										on:click={() => {
											window.location.href = `${WEBUI_BASE_URL}/oauth/microsoft/login`;
										}}
									>
										<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21" aria-hidden="true">
											<rect x="1" y="1" width="9" height="9" fill="#f25022" />
											<rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
											<rect x="11" y="1" width="9" height="9" fill="#7fba00" />
											<rect x="11" y="11" width="9" height="9" fill="#ffb900" />
										</svg>
										{$i18n.t('Continue with {{provider}}', { provider: 'Microsoft' })}
									</button>
								{/if}

								{#if runtimeConfig?.oauth?.providers?.github}
									<button
										class="oauth-btn"
										on:click={() => {
											window.location.href = `${WEBUI_BASE_URL}/oauth/github/login`;
										}}
									>
										<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
											<path
												fill="currentColor"
												d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.92 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57C20.565 21.795 24 17.31 24 12c0-6.63-5.37-12-12-12z"
											/>
										</svg>
										{$i18n.t('Continue with {{provider}}', { provider: 'GitHub' })}
									</button>
								{/if}

								{#if runtimeConfig?.oauth?.providers?.oidc}
									<button
										class="oauth-btn"
										on:click={() => {
											window.location.href = `${WEBUI_BASE_URL}/oauth/oidc/login`;
										}}
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
											stroke-width="1.5"
											stroke="currentColor"
											aria-hidden="true"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z"
											/>
										</svg>
										{$i18n.t('Continue with {{provider}}', {
											provider: runtimeConfig?.oauth?.providers?.oidc ?? 'SSO'
										})}
									</button>
								{/if}

								{#if runtimeConfig?.oauth?.providers?.feishu}
									<button
										class="oauth-btn"
										on:click={() => {
											window.location.href = `${WEBUI_BASE_URL}/oauth/feishu/login`;
										}}
									>
										{$i18n.t('Continue with {{provider}}', { provider: 'Feishu' })}
									</button>
								{/if}
							</div>
						{/if}

						{#if runtimeConfig?.features.enable_ldap && runtimeConfig?.features.enable_login_form}
							<div class="ldap-toggle">
								<button
									type="button"
									on:click={() => {
										if (mode === 'ldap')
											mode = (runtimeConfig?.onboarding ?? false) ? 'signup' : 'signin';
										else mode = 'ldap';
									}}
								>
									{mode === 'ldap' ? $i18n.t('Continue with Email') : $i18n.t('Continue with LDAP')}
								</button>
							</div>
						{/if}

						{#if runtimeConfig?.metadata?.login_footer}
							<div class="marked">
								{@html DOMPurify.sanitize(marked(runtimeConfig.metadata.login_footer))}
							</div>
						{/if}
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

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

	.qendra-logo {
		width: 300px !important;
		height: 300px !important;
		min-width: 130px !important;
		min-height: 130px !important;
		object-fit: cover;
		border-radius: 28px;
		padding: 10px;
		backdrop-filter: blur(14px);
		transition:
			transform 0.25s ease,
			box-shadow 0.25s ease;
		animation: aiAvatarFloat 5.5s ease-in-out infinite;
		transform-origin: center;
		will-change: transform;
	}

	@keyframes aiAvatarFloat {
		0%,
		100% {
			transform: translate3d(0, 0, 0) rotate(-0.7deg) scale(1);
		}
		50% {
			transform: translate3d(0, -10px, 0) rotate(0.7deg) scale(1.025);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.qendra-logo {
			animation: none;
		}
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
		background: linear-gradient(to bottom, transparent, rgba(255, 255, 255, 0.08), transparent);
	}

	.left-top {
		display: flex;
		align-items: center;
		flex-direction: column;
		gap: 60px;
	}

	.logo-chip {
		width: 200px;
		height: 200px;
		border-radius: 32px;

		display: flex;
		align-items: center;
		justify-content: center;

		overflow: visible;
	}

	.logo-chip img {
		border-radius: 24px;
	}
	.left-brand h1 {
		margin: 0;

		font-size: 1.6rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-align: center;

		color: #ffffff;

		line-height: 1;

		text-shadow:
			0 0 18px rgba(239, 68, 68, 0.18),
			0 0 32px rgba(239, 68, 68, 0.12);
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

	/* Keep Chrome/Safari password-manager autofill consistent with the dark form. */
	.field-input:-webkit-autofill,
	.field-input:-webkit-autofill:hover,
	.field-input:-webkit-autofill:focus,
	.field-input:-webkit-autofill:active {
		-webkit-text-fill-color: #f4f4f5 !important;
		caret-color: #ef4444;
		-webkit-box-shadow: 0 0 0 1000px #1b1b20 inset !important;
		box-shadow: 0 0 0 1000px #1b1b20 inset !important;
		transition: background-color 9999s ease-out 0s;
	}

	:global(.field-wrap > div) {
		width: 100%;
		position: relative;
		min-width: 0;
		display: flex;
		align-items: center;
	}

	:global(.field-wrap input),
	:global(.field-wrap input[type='password']),
	:global(.field-wrap input[type='text']) {
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

	:global(.field-wrap input:-webkit-autofill),
	:global(.field-wrap input:-webkit-autofill:hover),
	:global(.field-wrap input:-webkit-autofill:focus),
	:global(.field-wrap input:-webkit-autofill:active) {
		-webkit-text-fill-color: #f4f4f5 !important;
		caret-color: #ef4444;
		-webkit-box-shadow: 0 0 0 1000px #1b1b20 inset !important;
		box-shadow: 0 0 0 1000px #1b1b20 inset !important;
		transition: background-color 9999s ease-out 0s;
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

	.submit-btn .submit-security-icon {
		width: 21px;
		height: 21px;
		padding: 5px;
		box-sizing: content-box;
		border: 1px solid rgba(255, 255, 255, 0.24);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.13);
		filter: drop-shadow(0 4px 8px rgba(83, 4, 10, 0.35));
		transition: transform 180ms ease, background 180ms ease, border-color 180ms ease;
	}

	.submit-btn:hover:not(:disabled) .submit-security-icon {
		transform: scale(1.07);
		background: rgba(255, 255, 255, 0.2);
		border-color: rgba(255, 255, 255, 0.42);
	}

	.submit-btn .is-hidden {
		display: none;
	}

	.button-spinner {
		display: inline-block;
		width: 16px;
		height: 16px;
		margin-right: 8px;
		border: 2px solid rgba(255, 255, 255, 0.38);
		border-top-color: #fff;
		border-radius: 50%;
		vertical-align: -3px;
		animation: buttonSpin 0.75s linear infinite;
	}

	.auth-error {
		margin: 2px 0 8px;
		padding: 10px 12px;
		border: 1px solid rgba(239, 68, 68, 0.42);
		border-radius: 10px;
		background: rgba(127, 29, 29, 0.2);
		color: #fecaca;
		font-size: 0.78rem;
		line-height: 1.45;
	}

	.authorized-note {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		margin: 14px 0 0;
		color: #8f98a3;
		font-size: 0.72rem;
		letter-spacing: 0.04em;
	}

	.field-input:focus-visible,
	:global(.field-wrap input:focus-visible),
	.submit-btn:focus-visible,
	.mode-tab:focus-visible {
		outline: 2px solid #ef4444;
		outline-offset: 3px;
	}

	@keyframes buttonSpin {
		to { transform: rotate(360deg); }
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
	.ldap-toggle button,
	.ldap-toggle button:hover,
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

	/* Light login theme. The institutional logo asset remains unchanged. */
	:global(body) {
		background: #f4f5f7;
		color: #171717;
	}

	.auth-page {
		background:
			radial-gradient(circle at 18% 20%, rgba(164, 177, 73, 0.12), transparent 28%),
			radial-gradient(circle at 82% 26%, rgba(220, 38, 38, 0.07), transparent 25%),
			linear-gradient(135deg, #ffffff 0%, #f6f7f8 48%, #ffffff 100%);
		padding: 0;
		align-items: stretch;
		justify-content: stretch;
	}

	.grid-bg {
		background-image:
			linear-gradient(rgba(17, 24, 39, 0.035) 1px, transparent 1px),
			linear-gradient(90deg, rgba(17, 24, 39, 0.035) 1px, transparent 1px);
	}

	.radial-glow {
		background: radial-gradient(circle at center, rgba(164, 177, 73, 0.08), transparent 52%);
	}

	.scanlines {
		display: none;
	}

	.auth-shell {
		background: rgba(255, 255, 255, 0.94);
		width: 100vw;
		height: 100vh;
		max-width: none;
		min-height: 100vh;
		border: 0;
		border-radius: 0;
		box-shadow: none;
	}

	.left-panel {
		background: linear-gradient(155deg, #ffffff 0%, #f7f8f4 100%);
		padding-left: 82px;
		overflow: hidden;
	}

	.official-ribbon {
		position: absolute;
		inset: 0 auto 0 0;
		width: 42px;
		background: linear-gradient(180deg, #aebc42 0%, #8d9d25 42%, #53620f 100%);
		z-index: 1;
	}

	.official-ribbon span {
		position: absolute;
		left: 0;
		top: 38%;
		width: 42px;
		height: 128px;
		background: #263313;
		clip-path: polygon(0 48%, 100% 0, 100% 100%, 0 72%);
	}

	.left-panel::after {
		background: linear-gradient(to bottom, transparent, #d1d5db, transparent);
	}

	.left-brand h1 {
		color: #18181b;
		text-shadow: none;
		text-align: left;
		line-height: 1.12;
		letter-spacing: -0.025em;
	}

	.official-kicker {
		margin-bottom: 16px;
		color: #ef6666;
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.13em;
	}

	.left-top {
		align-items: flex-start;
		gap: 42px;
		position: relative;
		z-index: 2;
	}

	.platform-description {
		width: 100%;
		margin: -10px 0 0;
		text-align: center;
		color: #8b8b95;
		font-size: 0.95rem;
		letter-spacing: 0.01em;
	}

	@media (max-width: 1100px) and (min-width: 921px) {
		.left-panel {
			padding-left: 66px;
		}
	}

	.right-panel {
		background: linear-gradient(180deg, #ffffff, #f8fafc);
	}

	.auth-card {
		background: #ffffff;
		border-color: #e5e7eb;
		box-shadow: 0 18px 50px rgba(17, 24, 39, 0.12);
	}

	.card-title,
	.mobile-brand h2 {
		color: #18181b;
	}

	.card-subtitle,
	.field-label,
	.marked {
		color: #52525b;
	}

	.field-icon,
	:global(.field-wrap button) {
		color: #71717a;
	}

	.field-input,
	:global(.field-wrap input),
	:global(.field-wrap input[type='password']),
	:global(.field-wrap input[type='text']) {
		background: #f8fafc;
		border-color: #d4d4d8;
		color: #18181b !important;
		-webkit-text-fill-color: #18181b !important;
	}

	.field-input::placeholder,
	:global(.field-wrap input::placeholder) {
		color: #a1a1aa !important;
		-webkit-text-fill-color: #a1a1aa;
	}

	.field-input:focus,
	:global(.field-wrap input:focus) {
		background: #ffffff;
	}

	.field-input:-webkit-autofill,
	.field-input:-webkit-autofill:hover,
	.field-input:-webkit-autofill:focus,
	.field-input:-webkit-autofill:active,
	:global(.field-wrap input:-webkit-autofill),
	:global(.field-wrap input:-webkit-autofill:hover),
	:global(.field-wrap input:-webkit-autofill:focus),
	:global(.field-wrap input:-webkit-autofill:active) {
		-webkit-text-fill-color: #18181b !important;
		-webkit-box-shadow: 0 0 0 1000px #f8fafc inset !important;
		box-shadow: 0 0 0 1000px #f8fafc inset !important;
	}

	.mode-tab,
	.oauth-btn {
		background: #f8fafc;
		border-color: #d4d4d8;
		color: #3f3f46;
	}

	.oauth-btn:hover {
		background: #f1f5f9;
		border-color: #a1a1aa;
	}

	.oauth-divider hr {
		background: #e4e4e7;
	}

	.ldap-toggle,
	.marked,
	.ldap-toggle button,
	.ldap-toggle button:hover,
	.signing-in {
		color: #27272a;
	}

	/* Secure institutional theme */
	.auth-page {
		background: radial-gradient(circle at 70% 20%, #631017 0, transparent 34%),
			radial-gradient(circle at 32% 62%, #083646 0, transparent 30%), #03070a;
		color: #f8fafc;
	}
	.grid-bg {
		opacity: .28;
		background-size: 38px 38px;
		background-image: linear-gradient(#d92d3720 1px, transparent 1px),
			linear-gradient(90deg, #d92d3720 1px, transparent 1px);
		mask-image: linear-gradient(to right, #000, transparent 78%);
	}
	.radial-glow { background: radial-gradient(circle at 42% 48%, #159cc329, transparent 28%); }
	.scanlines {
		display: block; opacity: .12; pointer-events: none;
		background: repeating-linear-gradient(0deg, transparent 0 3px, #ffffff08 3px 4px);
	}
	.auth-shell { background: transparent; isolation: isolate; }
	.left-panel {
		position: relative; overflow: hidden;
		padding: clamp(42px, 5vw, 82px) clamp(42px, 6vw, 108px);
		background: linear-gradient(90deg, #02070bfa, #040a0eb8 72%, transparent);
	}
	.left-panel::before {
		content: ''; position: absolute; inset: 0; pointer-events: none;
		background: linear-gradient(115deg, transparent 52%, #ca202917);
	}
	.left-panel::after { display: none; }
	.official-ribbon { width: 6px; background: linear-gradient(transparent, #d9323b 24% 76%, transparent); box-shadow: 0 0 28px #d9323b80; }
	.official-ribbon span { display: none; }
	.left-top {
		width: min(100%, 760px); height: 100%; align-items: flex-start;
		justify-content: center; gap: clamp(20px, 2.7vh, 34px); position: relative; z-index: 2;
	}
	.institutional-heading { display: flex; align-items: center; gap: 14px; color: #e5e7eb; letter-spacing: .08em; }
	.institutional-heading > div { display: flex; flex-direction: column; gap: 4px; }
	.institutional-heading span:not(.institutional-mark) { color: #df3d45; font-size: .67rem; font-weight: 800; }
	.institutional-heading strong { max-width: 390px; font-size: .74rem; line-height: 1.35; }
	.institutional-mark {
		width: 48px;
		height: 48px;
		flex: 0 0 48px;
		object-fit: contain;
		background: transparent;
		filter: drop-shadow(0 0 9px rgba(225, 49, 57, 0.3));
	}
	.official-kicker { margin-bottom: 12px; color: #e54850; font-size: .7rem; letter-spacing: .19em; }
	.left-brand h1 {
		max-width: 720px; color: #fff; font-size: clamp(2.2rem, 4vw, 4.6rem);
		line-height: .98; letter-spacing: -.045em; text-shadow: 0 8px 42px #0008;
	}
	.platform-description { width: auto; margin: 0; align-self: center; color: #aab3bb; font-size: .86rem; text-align: center; }
	.security-status { display: flex; align-items: center; gap: 9px; align-self: center; color: #77848d; font-size: .62rem; font-weight: 700; letter-spacing: .14em; }
	.security-status span { width: 7px; height: 7px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 12px #4ade80; }
	.right-panel {
		position: relative;
		background: transparent;
	}
	.right-panel::before {
		display: none;
	}
	.auth-card {
		background: linear-gradient(145deg, #191619e8, #090d11f0);
		border: 1px solid #e5485040; backdrop-filter: blur(18px);
		box-shadow: 0 34px 90px #0008, 0 0 50px #b81b2417, inset 0 1px #ffffff0a;
	}
	.card-kicker { color: #ed555d; letter-spacing: .17em; }
	.card-title, .mobile-brand h2 { color: #fff; }
	.card-subtitle, .field-label, .marked { color: #aeb5bd; }
	.field-icon, :global(.field-wrap button) { color: #8d969f; }
	.field-input, :global(.field-wrap input), :global(.field-wrap input[type='password']), :global(.field-wrap input[type='text']) {
		background: #060a0eb8; border-color: #94a3b833; color: #f8fafc !important; -webkit-text-fill-color: #f8fafc !important;
	}
	.field-input::placeholder, :global(.field-wrap input::placeholder) { color: #69737e !important; -webkit-text-fill-color: #69737e; }
	.field-input:focus, :global(.field-wrap input:focus) { background: #0a0f14f0; border-color: #e7464eb8; box-shadow: 0 0 0 3px #e131391c; }
	.field-input:-webkit-autofill, .field-input:-webkit-autofill:hover, .field-input:-webkit-autofill:focus,
	:global(.field-wrap input:-webkit-autofill), :global(.field-wrap input:-webkit-autofill:hover), :global(.field-wrap input:-webkit-autofill:focus) {
		-webkit-text-fill-color: #f8fafc !important; -webkit-box-shadow: 0 0 0 1000px #0c1116 inset !important; box-shadow: 0 0 0 1000px #0c1116 inset !important;
	}
	.mode-tab, .oauth-btn { background: #ffffff09; border-color: #94a3b833; color: #d8dee5; }
	.oauth-btn:hover { background: #e131391a; border-color: #e131397a; }
	.oauth-divider hr { background: #94a3b82e; }
	.ldap-toggle, .marked, .ldap-toggle button, .ldap-toggle button:hover, .signing-in { color: #d5dbe1; }

	@keyframes aiAvatarFloat { 0%,100% { transform: translateY(0) rotate(-.35deg); } 50% { transform: translateY(-13px) rotate(.45deg); } }
	@keyframes aiAvatarScan { from { background-position: 140% 0,0 0; } to { background-position: -140% 0,0 0; } }
	@media (max-width: 1100px) and (min-width: 921px) {
		.left-panel { padding: 44px 46px; }
	}
	@media (max-width: 920px) {
		.auth-page { background: linear-gradient(155deg, #03070a, #16070a); }
		.right-panel { background: transparent; }
		.right-panel::before { display: none; }
		.mobile-brand .logo-chip { background: #071015; border: 1px solid #4ec5df4d; box-shadow: 0 0 32px #0d9ebe29; }
		.mobile-brand .qendra-logo { width: 100% !important; height: 100% !important; object-fit: cover; border-radius: 20px; }
	}

	/* Free-standing robot between the title and login */
	@media (min-width: 921px) {
		.auth-shell { grid-template-columns: 54% 46%; overflow: visible; }
		.left-panel { overflow: visible; padding-right: 190px; }
		.left-brand { max-width: 520px; }
		.left-brand h1 { max-width: 520px; font-size: clamp(2.15rem, 3.2vw, 3.7rem); }
		.platform-description, .security-status { align-self: flex-start; text-align: left; }
		.right-panel { padding-left: clamp(150px, 10vw, 205px); }
		.auth-card { position: relative; z-index: 7; }
	}

	@keyframes robotFloat {
		0%, 100% { transform: translateY(-48%) translateX(0) rotate(-.35deg); }
		50% { transform: translateY(calc(-48% - 12px)) translateX(4px) rotate(.4deg); }
	}

	@media (max-width: 1100px) and (min-width: 921px) {
		.left-panel { padding-right: 135px; }
		.right-panel { padding-left: 125px; padding-right: 24px; }
	}

	/* Dedicated robot layer: no inherited card/background styles */
	.robot-stage {
		display: none;
	}

	@media (min-width: 921px) {
		.robot-stage {
			display: block;
			position: absolute;
			top: 53%;
			right: -340px;
			z-index: 6;
			width: 330px;
			height: min(72vh, 680px);
			margin: 0;
			padding: 0;
			border: 0;
			border-radius: 0;
			background: none !important;
			box-shadow: none !important;
			backdrop-filter: none !important;
			overflow: visible;
			pointer-events: none;
			animation: robotFloat 6s ease-in-out infinite;
		}

		.robot-cutout {
			display: block;
			width: 100%;
			height: 100%;
			margin: 0;
			padding: 0;
			border: 0;
			border-radius: 0;
			background: transparent !important;
			object-fit: contain;
			object-position: center;
			filter: drop-shadow(0 26px 34px rgba(0, 0, 0, .72)) drop-shadow(0 0 15px rgba(25, 188, 218, .17));
		}
	}

	@media (max-width: 1100px) and (min-width: 921px) {
		.robot-stage { top: 52%; right: -265px; width: 245px; height: min(62vh, 550px); }
	}

	.submit-btn:focus-visible {
		outline: 3px solid rgba(248, 113, 113, .42);
		outline-offset: 4px;
	}

	.field-input:focus, :global(.field-wrap input:focus) {
		border-color: rgba(248, 81, 88, .9);
		box-shadow: 0 0 0 3px rgba(225, 49, 57, .13), 0 0 24px rgba(225, 49, 57, .1);
	}

	@media (prefers-reduced-motion: reduce) {
		.robot-stage { animation: none; transform: translateY(-48%); }
		.button-spinner { animation-duration: 1.4s; }
	}

	@media (max-width: 620px) {
		.auth-page { min-height: 100dvh; }
		.auth-shell { width: 100%; min-height: 100dvh; border: 0; border-radius: 0; }
		.right-panel { padding: 24px 16px; }
		.auth-card { width: 100%; padding: 26px 20px; border-radius: 18px; }
		.mobile-brand .logo-chip { width: 92px !important; height: 110px !important; }
		.card-title { font-size: 1.75rem; }
		.card-subtitle { font-size: 0.86rem; }
		.field-input, :global(.field-wrap input) { font-size: 16px !important; }
	}
</style>
