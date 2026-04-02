// Handle redirect result on page load
useEffect(() => {
  const handleRedirectResult = async () => {
    try {
      const result = await getRedirectResult(auth);
      if (result?.user) {
        const user = result.user;
        const providerName = user.providerData[0]?.providerId
          ?.includes('google') ? 'Google' : 'Facebook';

        const response = await api.post("/auth/firebase-login", {
          email: user.email,
          displayName: user.displayName,
          uid: user.uid,
          provider: providerName,
        });

        if (response.data.success) {
          login(response.data.token, response.data.user);
          navigate("/markets");
        }
      }
    } catch (err) {
      console.error("Redirect result error:", err);
      setError(err.response?.data?.message || "OAuth login failed");
    }
  };

  handleRedirectResult();
}, []);

// Replace old handleOAuthLogin with this:
const handleOAuthLogin = async (provider, providerName) => {
  try {
    setError("");
    setLoading(true);
    await signInWithRedirect(auth, provider);
    // Page will redirect — no code runs after this
  } catch (err) {
    console.error(`${providerName} login error:`, err);
    setError(`Failed to login with ${providerName}`);
    setLoading(false);
  }
};
