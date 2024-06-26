<script lang="ts">
	import { firebaseApp } from '$lib/firebase/config';
	import { onMount } from 'svelte';
	import { getMessaging, getToken, onMessage } from 'firebase/messaging';
	import { handleSignOut } from '$lib/firebase/auth';
	import { UserStore } from '$lib/stores/User';
	import { updateUserToken } from '$lib/firebase/firestore';
	import {
		ChevronLeft,
		Icon,
		Bell,
		UserGroup,
		ChevronRight,
		ArrowLeftStartOnRectangle
	} from 'svelte-hero-icons';
	import { goto } from '$app/navigation';
	import SmallLoader from '$lib/components/SmallLoader.svelte';
	import { fly } from 'svelte/transition';
	import ProfilePhoto from '$lib/components/ProfilePhoto.svelte';

	let messages = []; //array of messages received
	let messaging: any;

	let isNotifPermitted: boolean;
	let loading = false;

	$: {
		isNotifPermitted = $UserStore.notifsPermitted;
		loading = loading;
	}

	onMount(() => {
		//register the service worker before everything else
		if (navigator.serviceWorker) {
			// Register the SW
			navigator.serviceWorker
				.register('firebase-messaging-sw.js')
				.then(function (registration) {
					console.log('Service Worker registered with scope:', registration.scope);
				})
				.catch(function (error) {
					console.error('Service Worker registration failed:', error);
				});
		}

		// get the messaaging
		messaging = getMessaging(firebaseApp);

		// detect messages when the browser is open
		onMessage(messaging, (payload) => {
			messages.push(payload);

			// when the message is received show the notification
			console.log(payload.notification?.title);
			const notificationOptions = {
				body: payload.notification?.body
			};

			if (payload.notification?.title !== undefined) {
				new Notification(payload.notification?.title, notificationOptions);
			}
		});

		// check the user's permissions
		// note that this does not request for the permissions
		checkPermissions();
	});

	function requestPermission() {
		// Request for notification permissions from the user
		loading = true;

		Notification.requestPermission().then(async (permission) => {
			// if the permission has been granted, get the token
			console.log('requested permission', permission);
			if (permission === 'granted') {
				console.log(loading);
				// get the user token, then subscribe to the alerts
				console.log('permission has been granted, gonna get user token');
				getUserToken();
				await subscribeTokenToTopic($UserStore.notifToken, 'doorbell-alerts');
			} else {
				alert('Please enable notifications to receive alerts');
			}
		});
	}

	function getUserToken() {
		// get the user fcm token based on the vapidKey
		getToken(messaging, {
			vapidKey:
				'BAgbjDYolVbTrQZZ5y6zyf1Fmt2DnvVeK5fd2_34XM88gKL9W52RS2YwCRSvK3cW1BTnXG1SgTaGHUpJpRkhqdc'
		})
			.then(async (fetchedToken) => {
				//update firestore user information with token
				console.log('got usertoken');
				await updateUserStore(fetchedToken);
			})
			.catch((error) => {
				// edit handler for errors
				console.log('Error fetching token', error);
			});
	}

	async function checkPermissions(request: boolean = false) {
		if (window.Notification) {
			console.log('checking permissions in window notif');

			// if permissions have been granted
			// no need to worry about anything more!
			if (Notification.permission === 'granted') {
				console.log('notifs already granted');
				getUserToken();
				await subscribeTokenToTopic($UserStore.notifToken, 'doorbell-alerts');
			}
			// if permissions have not been granted
			else {
				// if the user requested to request permissions, then request permissions
				// otherwise, give an alert.
				if (request) {
					console.log('notifs setting to granted, will request permission');
					requestPermission();
				} else {
					alert('Please enable notifications to receive alerts');
				}
			}
		}
	}

	// function to subscribe to the topic
	async function subscribeTokenToTopic(token: string, topic: string) {
		const payload = { registrationToken: token, topic: topic };
		console.log('sub payload', payload);
		const response = await fetch('../../app/api/topics/subscribe', {
			method: 'PATCH',
			body: JSON.stringify(payload),
			headers: {
				'content-type': 'application/json'
			}
		});
	}

	// function to unsubscribe to the topic
	async function unsubscribeTokenToTopic(token: string, topic: string) {
		const payload = { registrationToken: token, topic: topic };
		console.log('unsub payload', payload);

		const response = await fetch('../../app/api/topics/unsubscribe', {
			method: 'PATCH',
			body: JSON.stringify(payload),
			headers: {
				'content-type': 'application/json'
			}
		});
	}

	// Called whenever the notification toggle is clicked
	async function handleNotifToggle(value: boolean) {
		loading = true;

		// if the notifs were permitted,
		if (value) {
			// update the user store to set it to false
			await updateUserStore('');
			// unsubscribe to the topic
			await unsubscribeTokenToTopic($UserStore.notifToken, 'doorbell-alerts');
			loading = false;
		}
		// if the notifs were not permitted
		else {
			// check if permissions have been granted
			// check permissions already checks if the permissions have been granted
			await checkPermissions(true);
			loading = false;
		}
	}

	async function updateUserStore(fetchedToken: any) {
		console.log($UserStore.uid);
		await updateUserToken($UserStore.uid, fetchedToken);

		if (fetchedToken == '') {
			UserStore.set({
				name: $UserStore.name,
				profilePhoto: $UserStore.profilePhoto,
				uid: $UserStore.uid,
				notifToken: $UserStore.notifToken,
				boxes: $UserStore.boxes,
				notifsPermitted: false
			});
		} else {
			UserStore.set({
				name: $UserStore.name,
				profilePhoto: $UserStore.profilePhoto,
				uid: $UserStore.uid,
				notifToken: $UserStore.notifToken,
				boxes: $UserStore.boxes,
				notifsPermitted: true
			});
		}

		return true;
	}
</script>

<section transition:fly={{ x: 3000, y: 0 }} class="h-calc([100%-20px]) max-h-svh">
	<div class="z-20 grid grid-cols-1 w-full h-svh bg-[#EEF2F5] absolute">
		<div class="flex flex-col items-center">
			<!-- Header -->
			<div class="flex items-center justify-between p-4 w-full my-4">
				<button
					on:click={() => {
						goto('/app/boxes');
					}}
					class="right-2"
				>
					<Icon src={ChevronLeft} solid size="20" />
				</button>
				<h4 class="-ml-4">Profile</h4>
				<div></div>
			</div>

			<!-- SETTING ITEMS -->
			<div class="w-[95%]">
				<!-- User profile -->
				<div class="w-full flex flex-col items-center gap-3">
					<ProfilePhoto></ProfilePhoto>
					<h4>{$UserStore.name}</h4>
				</div>

				<p class="w-full p-2 my-2">General</p>

				<!-- Main settings group -->
				<div class="grid bg-white w-full p-1 gap-1 rounded-[15px] border border-[#D9D9D9]/[.5]">
					<!-- Enable notification toggle -->
					<button
						class="flex flex-row justify-between items-center p-5"
						on:click={() => {
							handleNotifToggle(isNotifPermitted);
						}}
					>
						<div class="flex flex-row itens-center gap-3">
							<span class="text-bb-black/[0.8]">
								<Icon src={Bell} outline size="25" />
							</span>

							<p>Enable notifications</p>
						</div>

						<div class="flex flex-row gap-4 items-center">
							{#if loading}
								<SmallLoader />
							{/if}
							<label class="inline-flex items-center cursor-pointer">
								<input type="checkbox" class="sr-only peer" bind:checked={isNotifPermitted} />
								<div
									class="relative w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"
								></div>
							</label>
						</div>
					</button>

					<!-- Divider -->
					<div class="w-[95%] h-px bg-[#D9D9D9]/[.5] mx-[2.5%]"></div>

					<!-- About redirect -->
					<button class="flex flex-row justify-between items-center p-5" on:click>
						<div class="flex flex-row itens-center gap-3">
							<span class="text-bb-black/[0.8]">
								<Icon src={UserGroup} outline size="25" />
							</span>

							<p>About b0x0 Labs</p>
						</div>

						<span class="text-bb-black/[0.7]">
							<Icon src={ChevronRight} outline micro size="25" />
						</span>
					</button>
				</div>

				<button
					class="flex flex-row justify-between items-center p-5 w-full"
					on:click={handleSignOut}
				>
					<div class="flex flex-row itens-center gap-3">
						<span class="text-bb-black/[0.8]">
							<Icon src={ArrowLeftStartOnRectangle} outline size="25" />
						</span>

						<p>Sign Out</p>
					</div>
				</button>
			</div>
		</div>
	</div>
</section>
