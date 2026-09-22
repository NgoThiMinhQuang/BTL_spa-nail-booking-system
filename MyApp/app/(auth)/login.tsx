import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [emailOrPhone, setEmailOrPhone] = useState('user2005@gmail.com');
  const [password, setPassword] = useState('12345678');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const handleLogin = () => {
    // Navigate to main tab app upon login
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header Section with Banner & Logo */}
        <ImageBackground
          source={require('../../assets/images/banner/nail-banner-v2.png')}
          style={[styles.headerBanner, { paddingTop: insets.top + 20 }]}
          resizeMode="cover"
        >
          {/* Soft Tint Overlay */}
          <View style={styles.bannerOverlay} />

          {/* Logo Component */}
          <View style={styles.logoContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="flower-outline" size={28} color="#D56B81" />
            </View>
            <Text style={styles.logoText}>
              Nail<Text style={styles.brandAccent}>House</Text>
            </Text>
            <Text style={styles.logoTagline}>BEAUTY NAILS · BETTER YOU</Text>
          </View>
        </ImageBackground>

        {/* Top Organic SVG Wave Curve Transition */}
        <View style={styles.topWaveContainer}>
          <Svg
            height="80"
            width="100%"
            viewBox="0 0 375 80"
            preserveAspectRatio="none"
          >
            <Path
              d="M0,35 C60,20 130,65 220,60 C290,55 340,25 375,12 L375,80 L0,80 Z"
              fill="#FAF5F7"
            />
          </Svg>
        </View>

        {/* Main Content Form Card */}
        <View style={styles.cardContainer}>
          {/* Greeting Title */}
          <Text style={styles.title}>Chào mừng trở lại!</Text>
          <Text style={styles.subtitle}>
            Đăng nhập để tiếp tục hành trình làm đẹp{'\n'}cùng NailHouse ♡
          </Text>

          {/* Input: Phone or Email */}
          <View style={styles.inputContainer}>
            <Ionicons
              name="phone-portrait-outline"
              size={20}
              color="#A5939D"
              style={styles.inputIconLeft}
            />
            <TextInput
              style={styles.textInput}
              placeholder="Số điện thoại hoặc email"
              placeholderTextColor="#B5A5AF"
              value={emailOrPhone}
              onChangeText={setEmailOrPhone}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Input: Password */}
          <View style={styles.inputContainer}>
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color="#A5939D"
              style={styles.inputIconLeft}
            />
            <TextInput
              style={styles.textInput}
              placeholder="Mật khẩu"
              placeholderTextColor="#B5A5AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={10}
              style={styles.eyeIcon}
            >
              <Ionicons
                name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color="#A5939D"
              />
            </Pressable>
          </View>

          {/* Remember Me & Forgot Password */}
          <View style={styles.optionsRow}>
            <Pressable
              style={styles.rememberContainer}
              onPress={() => setRememberMe(!rememberMe)}
            >
              <View
                style={[
                  styles.checkbox,
                  rememberMe && styles.checkboxChecked,
                ]}
              >
                {rememberMe && (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                )}
              </View>
              <Text style={styles.rememberText}>Ghi nhớ đăng nhập</Text>
            </Pressable>

            <Pressable onPress={() => { }}>
              <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
            </Pressable>
          </View>

          {/* Login Button */}
          <Pressable
            style={({ pressed }) => [
              styles.loginButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleLogin}
          >
            <Text style={styles.loginButtonText}>Đăng nhập</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={styles.buttonArrow} />
          </Pressable>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Hoặc đăng nhập với</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social Login Buttons */}
          <View style={styles.socialRow}>
            {/* Google Button */}
            <Pressable
              style={({ pressed }) => [
                styles.socialButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => { }}
            >
              <Ionicons name="logo-google" size={18} color="#EA4335" />
              <Text style={styles.socialButtonText}>Google</Text>
            </Pressable>

            {/* Apple Button */}
            <Pressable
              style={({ pressed }) => [
                styles.socialButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => { }}
            >
              <Ionicons name="logo-apple" size={20} color="#000000" />
              <Text style={styles.socialButtonText}>Apple</Text>
            </Pressable>
          </View>

          {/* Footer Navigation Link */}
          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>Chưa có tài khoản? </Text>
            <Pressable
              style={styles.registerLink}
              onPress={() => router.push('/(auth)/register')}
            >
              <Text style={styles.registerText}>Đăng ký ngay</Text>
              <Ionicons
                name="arrow-forward"
                size={16}
                color="#D56B81"
                style={{ marginLeft: 4 }}
              />
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Decorative Bottom Wave Shape */}
      <View style={styles.bottomDecorativeWave} pointerEvents="none">
        <Svg height="140" width="160" viewBox="0 0 160 140">
          <Path
            d="M0,45 C50,45 110,85 160,140 L0,140 Z"
            fill="rgba(213, 107, 129, 0.12)"
          />
        </Svg>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF5F7',
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerBanner: {
    height: 310,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 30,
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 245, 248, 0.45)',
  },
  logoContainer: {
    alignItems: 'center',
    zIndex: 2,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D56B81',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#D56B81',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  logoText: {
    fontSize: 30,
    fontWeight: '800',
    color: '#333333',
    letterSpacing: 0.5,
  },
  brandAccent: {
    color: '#D56B81',
  },
  logoTagline: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8A7B80',
    letterSpacing: 1.5,
    marginTop: 3,
  },
  topWaveContainer: {
    height: 80,
    marginTop: -80,
    width: '100%',
  },
  cardContainer: {
    flex: 1,
    backgroundColor: '#FAF5F7',
    paddingHorizontal: 26,
    paddingTop: 4,
    paddingBottom: 36,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#261B20',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#7C6C74',
    lineHeight: 22,
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFE5EB',
    borderRadius: 14,
    height: 54,
    paddingHorizontal: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  inputIconLeft: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#261B20',
    paddingVertical: 0,
  },
  eyeIcon: {
    padding: 4,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  rememberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#D56B81',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#D56B81',
  },
  rememberText: {
    fontSize: 14,
    color: '#5A4A52',
    marginLeft: 8,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D56B81',
  },
  loginButton: {
    height: 52,
    backgroundColor: '#D56B81',
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#D56B81',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonArrow: {
    marginLeft: 8,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 26,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#EBE0E5',
  },
  dividerText: {
    fontSize: 13,
    color: '#9E8A94',
    paddingHorizontal: 14,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 32,
  },
  socialButton: {
    flex: 1,
    height: 50,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFE5EB',
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  socialButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#261B20',
    marginLeft: 8,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#7C6C74',
  },
  registerLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  registerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#D56B81',
  },
  bottomDecorativeWave: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 160,
    height: 140,
  },
});
