import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, Lock, Mail, User, AlertCircle } from 'lucide-react-native';
import { useAuth } from '../hooks/useAuth';
import { theme } from '../lib/theme';
import { Button } from '../components/Button';
import { Card } from '../components/Card';

export default function AuthScreen() {
  const router = useRouter();
  const { login, register, isLoading } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      if (mode === 'register') {
        if (!name.trim()) {
          setError('Please enter your full name');
          return;
        }
        await register(name.trim(), email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
      router.back();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
              <X size={22} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </Text>
            <View style={{ width: 22 }} />
          </View>

          {/* Mode Switcher */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, mode === 'login' && styles.activeTab]}
              onPress={() => {
                setMode('login');
                setError(null);
              }}
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
              }}
            >
              <Text style={[styles.tabText, mode === 'register' && styles.activeTabText]}>
                Register
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Card */}
          <Card style={styles.formCard}>
            {error && (
              <View style={styles.errorBox}>
                <AlertCircle size={18} color={theme.colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

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
                  />
                </View>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <Mail size={18} color={theme.colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="name@example.com"
                  placeholderTextColor={theme.colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <Lock size={18} color={theme.colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder={mode === 'register' ? 'Min 8 characters' : 'Enter password'}
                  placeholderTextColor={theme.colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>
            </View>

            <Button
              title={mode === 'login' ? 'Sign In' : 'Create Free Account'}
              onPress={handleSubmit}
              loading={isLoading}
              style={styles.submitBtn}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: theme.spacing.xl,
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
    marginBottom: theme.spacing.xl,
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
  formCard: {
    padding: theme.spacing.xl,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.expenseBg,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
  },
  errorText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.expense,
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
  },
  submitBtn: {
    marginTop: theme.spacing.sm,
  },
});
