import React, { createContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as fbSignOut, GoogleAuthProvider } from 'firebase/auth';
import { auth, googleProvider } from "../firebaseConfig";
import { doc, setDoc, collection, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import defaultPfp from "../../assets/default-pfp.png";
import { GeoPoint } from 'firebase/firestore';

export const AuthContext = createContext({
	user: null,
	idToken: null,
	accessToken: null,
	loading: true,
	error: null,
	firestoreUser: null,
	firestoreLoading: false,
	authError: null,
	firestoreError: null,
	signInWithGoogle: async () => {},
	signOut: async () => {},
	refreshIdToken: async () => {},
});

export function AuthProvider({ children }) {
	const [user, setUser] = useState(() => auth.currentUser || null);
	const [idToken, setIdToken] = useState(null);
	const [accessToken, setAccessToken] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	// Firestore user state
	const [firestoreUser, setFirestoreUser] = useState(null);
	const [firestoreLoading, setFirestoreLoading] = useState(false);

	// Auth and Firestore error states
	const [authError, setAuthError] = useState(null);
	const [firestoreError, setFirestoreError] = useState(null);

	// Helper to get user's location
	const getUserLocation = () => {
		return new Promise((resolve, reject) => {
			if (navigator.geolocation) {
				navigator.geolocation.getCurrentPosition(
					(position) => {
						const { latitude, longitude } = position.coords;
						resolve({ latitude, longitude });
					},
					(error) => reject(error)
				);
			} else {
				reject(new Error('Geolocation is not supported by this browser.'));
			}
		});
	};

	// Sign in helper using Firebase popup with Google provider
	const signInWithGoogle = useCallback(async () => {
		setLoading(true);
		setAuthError(null);
		try {
			const res = await signInWithPopup(auth, googleProvider);
			const credential = GoogleAuthProvider.credentialFromResult(res);
			const at = credential?.accessToken ?? null;
			const u = res.user || null;
			setUser(u);
			setAccessToken(at);

			if (u) {
				const t = await u.getIdToken();
				setIdToken(t);

				// Check if user document exists
				const userDocRef = doc(db, 'users', u.uid);
				const userDoc = await getDoc(userDocRef);

				if (!userDoc.exists()) {
					// Get default profile image URL
					const profileImageUrl = u.photoURL || defaultPfp;

					// Get user location
					let location = null;
					try {
						const { latitude, longitude } = await getUserLocation();
						location = new GeoPoint(latitude, longitude); // Convert to Firestore GeoPoint
					} catch (error) {
						console.error('Error getting location:', error);
					}

					// Set default user document
					await setDoc(userDocRef, {
						actualMonthlyBill: 0,
						connections: {},
						consumptionSharingPrivacy: 'private',
						consumptionSummary: {
							isCalculatedBefore: false,
							applianceCount: 0,
							estimatedDailyBill: 0,
							estimatedWeeklyBill: 0,
							estimatedMonthlyBill: 0,
							topAppliance: '',
						},
						credibilityScore: 0,
						displayName: u.displayName || 'Anonymous',
						email: u.email,
						lastReportTime: null,
						location,
						pendingRequestsIn: {},
						pendingRequestsOut: {},
						profileImageUrl,
						userRole: 'regular',
						locationSharingPrivacy: 'private',
					});
				}
			}

			setLoading(false);
			return res;
		} catch (e) {
			setAuthError(e);
			setLoading(false);
			throw e;
		}
	}, []);

	const signOut = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			await fbSignOut(auth);
			setUser(null);
			setIdToken(null);
			setAccessToken(null);
			setLoading(false);
		} catch (e) {
			setError(e);
			setLoading(false);
			throw e;
		}
	}, []);

	// Fetch Firestore user data on user state change
	useEffect(() => {
		if (user) {
			const fetchFirestoreUser = () => {
				setFirestoreLoading(true);
				setFirestoreError(null);
				const userDocRef = doc(db, 'users', user.uid);
				const unsubscribe = onSnapshot(userDocRef, (docSnapshot) => {
					if (docSnapshot.exists()) {
						setFirestoreUser(docSnapshot.data());
					} else {
						setFirestoreUser(null);
					}
					setFirestoreLoading(false);
				}, (error) => {
					setFirestoreError(error);
					console.error('Error fetching Firestore user data:', error);
					setFirestoreLoading(false);
				});

				return unsubscribe; // Cleanup the listener on unmount
			};

			const unsubscribe = fetchFirestoreUser();
			return () => unsubscribe();
		} else {
			setFirestoreUser(null);
		}
	}, [user]);

	// Token refresh logic
	const refreshIdToken = async () => {
		if (user) {
			try {
				const newIdToken = await user.getIdToken(true);
				setIdToken(newIdToken);
			} catch (error) {
				console.error('Error refreshing ID token:', error);
			}
		}
	};

	useEffect(() => {
		let mounted = true;
		const unsubscribe = onAuthStateChanged(auth, async (u) => {
			if (!mounted) return;
			try {
				setUser(u);
				if (u) {
					const t = await u.getIdToken();
					setIdToken(t);
				} else {
					setIdToken(null);
				}
				setLoading(false);
			} catch (e) {
				setError(e);
				setLoading(false);
			}
		}, (err) => {
			if (!mounted) return;
			setError(err);
			setLoading(false);
		});

		return () => {
			mounted = false;
			unsubscribe();
		};
	}, []);

	const value = {
		user,
		idToken,
		accessToken,
		loading,
		firestoreUser,
		firestoreLoading,
		authError,
		firestoreError,
		error,
		signInWithGoogle,
		signOut,
		refreshIdToken,
	};

	return (
		<AuthContext.Provider value={value}>
			{children}
		</AuthContext.Provider>
	);
}

export default AuthProvider;