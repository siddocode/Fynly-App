import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeRouter } from '../hooks/useSafeRouter';
import {
  X,
  Lock,
  Mail,
  User,
  AlertCircle,
  KeyRound,
  ShieldCheck,
  ArrowLeft,
  RotateCw,
} from 'lucide-react-native';
import { useAuth } from '../hooks/useAuth';
import { useTheme, Theme } from '../lib/theme';
import { Button } from '../components/Button';
import { Card } from '../components/Card';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function AuthScreen() {
  const router = useSafeRouter();
  const { theme } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const { login, register, sendOtp, verifyOtp, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated]);

  // Mode: login or register
  const [mode, setMode] = useState<'login' | 'register'>('login');
  // Method: otp or password
  const [method, setMethod] = useState<'otp' | 'password'>('otp');
  // OTP step: 'enter-email' | 'enter-otp'
  const [otpStep, setOtpStep] = useState<'enter-email' | 'enter-otp'>('enter-email');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const scrollViewRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const emailInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const passwordInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const otpCodeInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const isDismissedRef = useRef(false);
  const safeDismiss = React.useCallback(() => {
    if (isDismissedRef.current) return;
    isDismissedRef.current = true;
    if (typeof router.canGoBack === 'function' && router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, [router]);

  useEffect(() => {
    const backAction = () => {
      if (isLoading) {
        return true;
      }
      safeDismiss();
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [isLoading, safeDismiss]);

  const scrollToOffset = (y: number) => {
    scrollViewRef.current?.scrollTo({ y, animated: true });
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y, animated: true });
    }, 150);
  };

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isDuplicateAccount, setIsDuplicateAccount] = useState<boolean>(false);

  // Countdown timer for OTP resend
  const [resendTimer, setResendTimer] = useState<number>(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const validateEmail = (val: string): boolean => {
    return EMAIL_REGEX.test(val.trim().toLowerCase());
  };

  const handleSendOtp = async () => {
    if (isLoading) return;
    setError(null);
    setSuccessMsg(null);
    setIsDuplicateAccount(false);

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError('Please enter your email address');
      return;
    }

    if (!validateEmail(cleanEmail)) {
      setError('Please enter a valid email address (e.g. name@example.com)');
      return;
    }

    if (mode === 'register' && !name.trim()) {
      setError('Please enter your full name');
      return;
    }

    try {
      const purpose = mode === 'register' ? 'REGISTER' : 'LOGIN';
      const res = await sendOtp(cleanEmail, purpose);
      if (res?.data?.debugOtp) {
        setOtpCode(res.data.debugOtp);
      }
      setSuccessMsg(`A 6-digit verification code has been sent to ${cleanEmail}`);
      setOtpStep('enter-otp');
      setResendTimer(60);
    } catch (err: any) {
      const msg = err.message || 'Failed to send verification code';
      setError(msg);
      if (msg.toLowerCase().includes('already exists')) {
        setIsDuplicateAccount(true);
      }
    }
  };

  const handleVerifyOtp = async () => {
    if (isLoading) return;
    setError(null);
    const cleanOtp = otpCode.trim();

    if (cleanOtp.length !== 6) {
      setError('Please enter the full 6-digit verification code');
      return;
    }

    try {
      const cleanEmail = email.trim().toLowerCase();
      const purpose = mode === 'register' ? 'REGISTER' : 'LOGIN';
      await verifyOtp(cleanEmail, cleanOtp, purpose, name.trim());
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message || 'Invalid or expired code. Please try again.');
    }
  };

  const handlePasswordSubmit = async () => {
    if (isLoading) return;
    setError(null);
    setIsDuplicateAccount(false);

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password.trim()) {
      setError('Please fill in both email and password');
      return;
    }

    if (!validateEmail(cleanEmail)) {
      setError('Please enter a valid email address (e.g. name@example.com)');
      return;
    }

    if (mode === 'register') {
      if (!name.trim()) {
        setError('Please enter your full name');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters long');
        return;
      }
    }

    try {
      if (mode === 'register') {
        await register(name.trim(), cleanEmail, password);
      } else {
        await login(cleanEmail, password);
      }
      router.replace('/(tabs)');
    } catch (err: any) {
      const msg = err.message || 'Authentication failed. Please check your credentials.';
      setError(msg);
      if (msg.toLowerCase().includes('already exists')) {
        setIsDuplicateAccount(true);
      }
    }
  };

  const switchToLogin = () => {
    setMode('login');
    setError(null);
    setIsDuplicateAccount(false);
    setOtpStep('enter-email');
    setOtpCode('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 70 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 360 }]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={safeDismiss}
              disabled={isLoading}
              style={[styles.closeBtn, isLoading && { opacity: 0.4 }]}
            >
              <X size={22} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </Text>
            <View style={{ width: 22 }} />
          </View>

          {/* Mode Switcher: Sign In vs Register */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, mode === 'login' && styles.activeTab]}
              onPress={switchToLogin}
            >
              <Text style={[styles.tabText, mode === 'login' && styles.activeTabText]}>
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === 'register' && styles.activeTab]}
              onPress={() => {
                setMode('register');
                setError(null);
                setIsDuplicateAccount(false);
                setOtpStep('enter-email');
                setOtpCode('');
              }}
            >
              <Text style={[styles.tabText, mode === 'register' && styles.activeTabText]}>
                Register
              </Text>
            </TouchableOpacity>
          </View>

          {/* Method Switcher: OTP vs Password */}
          <View style={styles.methodSwitcher}>
            <TouchableOpacity
              style={[styles.methodBtn, method === 'otp' && styles.activeMethodBtn]}
              onPress={() => {
                setMethod('otp');
                setError(null);
                setOtpStep('enter-email');
              }}
            >
              <KeyRound
                size={16}
                color={method === 'otp' ? theme.colors.primary : theme.colors.textMuted}
              />
              <Text style={[styles.methodText, method === 'otp' && styles.activeMethodText]}>
                One-Time Code (OTP)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.methodBtn, method === 'password' && styles.activeMethodBtn]}
              onPress={() => {
                setMethod('password');
                setError(null);
              }}
            >
              <Lock
                size={16}
                color={method === 'password' ? theme.colors.primary : theme.colors.textMuted}
              />
              <Text style={[styles.methodText, method === 'password' && styles.activeMethodText]}>
                Password
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Card */}
          <Card style={styles.formCard}>
            {/* Error Banner */}
            {error && (
              <View style={styles.errorBox}>
                <AlertCircle size={18} color={theme.colors.error} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.errorText}>{error}</Text>
                  {isDuplicateAccount && (
                    <TouchableOpacity onPress={switchToLogin} style={styles.switchLinkBtn}>
                      <Text style={styles.switchLinkText}>Switch to Sign In tab</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* Success Banner */}
            {successMsg && (
              <View style={styles.successBox}>
                <ShieldCheck size={18} color={theme.colors.primary} />
                <Text style={styles.successText}>{successMsg}</Text>
              </View>
            )}

            {/* OTP FLOW */}
            {method === 'otp' ? (
              otpStep === 'enter-email' ? (
                // Step 1: Enter Name & Email for OTP
                <View>
                  {mode === 'register' && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Full Name</Text>
                      <View style={styles.inputWrapper}>
                        <User size={18} color={theme.colors.textMuted} />
                        <TextInput
                          style={styles.input}
                          placeholder="Jane Doe"
                          placeholderTextColor={theme.colors.textMuted}
                          value={name}
                          onChangeText={setName}
                          autoCapitalize="words"
                          returnKeyType="next"
                          blurOnSubmit={false}
                          editable={!isLoading}
                          onFocus={() => scrollToOffset(40)}
                          onSubmitEditing={() => emailInputRef.current?.focus()}
                        />
                      </View>
                    </View>
                  )}

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Email Address</Text>
                    <View style={styles.inputWrapper}>
                      <Mail size={18} color={theme.colors.textMuted} />
                      <TextInput
                        ref={emailInputRef}
                        style={styles.input}
                        placeholder="name@example.com"
                        placeholderTextColor={theme.colors.textMuted}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="go"
                        blurOnSubmit={true}
                        editable={!isLoading}
                        onFocus={() => scrollToOffset(100)}
                        onSubmitEditing={handleSendOtp}
                      />
                    </View>
                    <Text style={styles.hintText}>
                      We'll send a 6-digit confirmation code via Brevo to this email.
                    </Text>
                  </View>

                  <Button
                    title="Send Verification Code"
                    onPress={handleSendOtp}
                    loading={isLoading}
                    style={styles.submitBtn}
                  />
                </View>
              ) : (
                // Step 2: Enter 6-Digit OTP Code
                <View>
                  <View style={styles.emailBadge}>
                    <Mail size={14} color={theme.colors.primary} />
                    <Text style={styles.emailBadgeText} numberOfLines={1}>
                      Code sent to: {email}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setOtpStep('enter-email');
                        setOtpCode('');
                        setError(null);
                      }}
                      style={styles.editEmailBtn}
                    >
                      <Text style={styles.editEmailText}>Change</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Enter 6-Digit Code</Text>
                    <View style={[styles.inputWrapper, styles.otpWrapper]}>
                      <KeyRound size={20} color={theme.colors.primary} />
                      <TextInput
                        ref={otpCodeInputRef}
                        style={styles.otpInput}
                        placeholder="••••••"
                        placeholderTextColor={theme.colors.textMuted}
                        value={otpCode}
                        onChangeText={(txt) => setOtpCode(txt.replace(/[^0-9]/g, '').slice(0, 6))}
                        keyboardType="number-pad"
                        maxLength={6}
                        editable={!isLoading}
                        onFocus={() => scrollToOffset(120)}
                        autoFocus
                      />
                    </View>
                  </View>

                  <Button
                    title={mode === 'register' ? 'Verify & Create Account' : 'Verify & Sign In'}
                    onPress={handleVerifyOtp}
                    loading={isLoading}
                    style={styles.submitBtn}
                  />

                  {/* Resend OTP */}
                  <View style={styles.resendContainer}>
                    {resendTimer > 0 ? (
                      <Text style={styles.resendTimerText}>
                        Resend code in <Text style={{ color: theme.colors.primary }}>{resendTimer}s</Text>
                      </Text>
                    ) : (
                      <TouchableOpacity
                        onPress={handleSendOtp}
                        disabled={isLoading}
                        style={styles.resendBtn}
                      >
                        <RotateCw size={14} color={theme.colors.primary} />
                        <Text style={styles.resendBtnText}>Resend verification code</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )
            ) : (
              // PASSWORD FLOW
              <View>
                {mode === 'register' && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Full Name</Text>
                    <View style={styles.inputWrapper}>
                      <User size={18} color={theme.colors.textMuted} />
                      <TextInput
                        style={styles.input}
                        placeholder="Jane Doe"
                        placeholderTextColor={theme.colors.textMuted}
                        value={name}
                        onChangeText={setName}
                        autoCapitalize="words"
                        returnKeyType="next"
                        blurOnSubmit={false}
                        editable={!isLoading}
                        onFocus={() => scrollToOffset(40)}
                        onSubmitEditing={() => emailInputRef.current?.focus()}
                      />
                    </View>
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email Address</Text>
                  <View style={styles.inputWrapper}>
                    <Mail size={18} color={theme.colors.textMuted} />
                    <TextInput
                      ref={emailInputRef}
                      style={styles.input}
                      placeholder="name@example.com"
                      placeholderTextColor={theme.colors.textMuted}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      editable={!isLoading}
                      onFocus={() => scrollToOffset(100)}
                      onSubmitEditing={() => passwordInputRef.current?.focus()}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.inputWrapper}>
                    <Lock size={18} color={theme.colors.textMuted} />
                    <TextInput
                      ref={passwordInputRef}
                      style={styles.input}
                      placeholder={mode === 'register' ? 'Min 8 characters' : 'Enter password'}
                      placeholderTextColor={theme.colors.textMuted}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      returnKeyType="go"
                      blurOnSubmit={true}
                      editable={!isLoading}
                      onFocus={() => scrollToOffset(160)}
                      onSubmitEditing={handlePasswordSubmit}
                    />
                  </View>
                </View>

                <Button
                  title={mode === 'login' ? 'Sign In' : 'Create Free Account'}
                  onPress={handlePasswordSubmit}
                  loading={isLoading}
                  style={styles.submitBtn}
                />
              </View>
            )}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      padding: theme.spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.lg,
    },
    closeBtn: {
      padding: 6,
    },
    headerTitle: {
      fontSize: theme.typography.sizes.xl,
      fontWeight: theme.typography.weights.bold,
      color: theme.colors.textPrimary,
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surfaceSubtle,
      borderRadius: theme.borderRadius.md,
      padding: 4,
      marginBottom: theme.spacing.md,
    },
    tab: {
      flex: 1,
      paddingVertical: theme.spacing.sm,
      alignItems: 'center',
      borderRadius: theme.borderRadius.sm,
    },
    activeTab: {
      backgroundColor: theme.colors.surface,
    },
    tabText: {
      fontSize: theme.typography.sizes.sm,
      fontWeight: theme.typography.weights.medium,
      color: theme.colors.textMuted,
    },
    activeTabText: {
      color: theme.colors.textPrimary,
      fontWeight: theme.typography.weights.bold,
    },
    methodSwitcher: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.lg,
    },
    methodBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      backgroundColor: theme.colors.surfaceSubtle,
    },
    activeMethodBtn: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.surface,
    },
    methodText: {
      fontSize: theme.typography.sizes.xs,
      color: theme.colors.textMuted,
      fontWeight: theme.typography.weights.medium,
    },
    activeMethodText: {
      color: theme.colors.textPrimary,
      fontWeight: theme.typography.weights.bold,
    },
    formCard: {
      padding: theme.spacing.xl,
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.expenseBg,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.lg,
    },
    errorText: {
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.expense,
    },
    switchLinkBtn: {
      marginTop: 6,
      alignSelf: 'flex-start',
    },
    switchLinkText: {
      fontSize: theme.typography.sizes.xs,
      color: theme.colors.primary,
      fontWeight: theme.typography.weights.bold,
    },
    successBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.lg,
    },
    successText: {
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.primary,
      flex: 1,
    },
    inputGroup: {
      marginBottom: theme.spacing.lg,
    },
    label: {
      fontSize: theme.typography.sizes.xs,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.xs,
      fontWeight: theme.typography.weights.medium,
    },
    hintText: {
      fontSize: 11,
      color: theme.colors.textMuted,
      marginTop: 6,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.md,
      height: 48,
    },
    input: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.base,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
    },
    otpWrapper: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.surfaceSubtle,
    },
    otpInput: {
      flex: 1,
      color: theme.colors.primary,
      fontSize: 24,
      fontWeight: '700',
      letterSpacing: 10,
      textAlign: 'center',
    },
    emailBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.colors.surfaceSubtle,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.lg,
    },
    emailBadgeText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      flex: 1,
    },
    editEmailBtn: {
      paddingVertical: 2,
      paddingHorizontal: 6,
    },
    editEmailText: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: 'bold',
    },
    submitBtn: {
      marginTop: theme.spacing.sm,
    },
    resendContainer: {
      marginTop: theme.spacing.md,
      alignItems: 'center',
    },
    resendTimerText: {
      fontSize: theme.typography.sizes.xs,
      color: theme.colors.textMuted,
    },
    resendBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      padding: 6,
    },
    resendBtnText: {
      fontSize: theme.typography.sizes.xs,
      color: theme.colors.primary,
      fontWeight: theme.typography.weights.medium,
    },
  });
