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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, G } from 'react-native-svg';

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [fullName, setFullName] = useState('Ngô Minh Quang');
  const [phone, setPhone] = useState('0987654321');
  const [email, setEmail] = useState('user2005@gmail.com');
  const [password, setPassword] = useState('12345678');
  const [confirmPassword, setConfirmPassword] = useState('12345678');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);

  const handleRegister = () => {
    // Navigate to login after registration
    router.replace('/(auth)/login');
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
        {/* Top Header Row with Back Button & Decorative Floral Corner */}
        <View style={[styles.headerContainer, { paddingTop: insets.top + 10 }]}>
          {/* Back Button */}
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={12}
          >
            <Ionicons name="arrow-back" size={24} color="#261B20" />
          </Pressable>

          {/* Top Right Decorative Organic Blob with Botanical Line-Art */}
          <View style={styles.topRightDecorativeBlob} pointerEvents="none">
            <Svg height="160" width="160" viewBox="0 0 160 160">
              {/* Soft Rose Background Curve */}
              <Path
                d="M40,0 C90,0 160,40 160,110 C160,160 110,160 80,120 C50,80 0,60 0,0 Z"
                fill="rgba(213, 107, 129, 0.12)"
              />
              {/* Line Art Floral Artwork */}
              <G stroke="#A56E7B" strokeWidth="1.2" fill="none">
                <Path d="M120,130 Q110,70 145,25" />
                <Path d="M145,25 Q130,40 115,35 Q125,50 145,25" />
                <Path d="M135,45 Q105,50 95,65 Q115,75 135,45" />
                <Path d="M125,75 Q95,90 90,110 Q110,115 125,75" />
              </G>
            </Svg>
          </View>

          {/* Centered Brand Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="flower-outline" size={26} color="#D56B81" />
            </View>
            <Text style={styles.logoText}>
              Nail<Text style={styles.brandAccent}>House</Text>
            </Text>
            <View style={styles.sloganRow}>
              <Text style={styles.logoTagline}>BEAUTY NAILS · BETTER YOU</Text>
              <View style={styles.sloganLine} />
            </View>
          </View>
        </View>

        {/* Main Content Form Section */}
        <View style={styles.formContainer}>
          {/* Greeting Title */}
          <Text style={styles.title}>Tạo tài khoản</Text>
          <Text style={styles.subtitle}>
            Tham gia cùng NailHouse để trải nghiệm{'\n'}những dịch vụ làm đẹp tuyệt vời nhất!
          </Text>

          {/* Field 1: Họ và tên */}
          <View style={styles.inputContainer}>
            <Ionicons
              name="person-outline"
              size={20}
              color="#A5939D"
              style={styles.inputIconLeft}
            />
            <TextInput
              style={styles.textInput}
              placeholder="Họ và tên"
              placeholderTextColor="#B5A5AF"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          {/* Field 2: Số điện thoại */}
          <View style={styles.inputContainer}>
            <Ionicons
              name="phone-portrait-outline"
              size={20}
              color="#A5939D"
              style={styles.inputIconLeft}
            />
            <TextInput
              style={styles.textInput}
              placeholder="Số điện thoại"
              placeholderTextColor="#B5A5AF"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          {/* Field 3: Email */}
          <View style={styles.inputContainer}>
            <Ionicons
              name="mail-outline"
              size={20}
              color="#A5939D"
              style={styles.inputIconLeft}
            />
            <TextInput
              style={styles.textInput}
              placeholder="Email"
              placeholderTextColor="#B5A5AF"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Field 4: Mật khẩu */}
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

          {/* Field 5: Nhập lại mật khẩu */}
          <View style={styles.inputContainer}>
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color="#A5939D"
              style={styles.inputIconLeft}
            />
            <TextInput
              style={styles.textInput}
              placeholder="Nhập lại mật khẩu"
              placeholderTextColor="#B5A5AF"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
            />
            <Pressable
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              hitSlop={10}
              style={styles.eyeIcon}
            >
              <Ionicons
                name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color="#A5939D"
              />
            </Pressable>
          </View>

          {/* Terms Checkbox */}
          <Pressable
            style={styles.termsContainer}
            onPress={() => setAgreeTerms(!agreeTerms)}
          >
            <View
              style={[
                styles.checkbox,
                agreeTerms && styles.checkboxChecked,
              ]}
            >
              {agreeTerms && (
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              )}
            </View>
            <Text style={styles.termsText}>
              Tôi đồng ý với{' '}
              <Text style={styles.termsHighlight}>Điều khoản sử dụng</Text> và{' '}
              <Text style={styles.termsHighlight}>Chính sách bảo mật</Text> của NailHouse
            </Text>
          </Pressable>

          {/* Register Button */}
          <Pressable
            style={({ pressed }) => [
              styles.registerButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleRegister}
          >
            <Text style={styles.registerButtonText}>Đăng ký</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={styles.buttonArrow} />
          </Pressable>

          {/* Footer Navigation Link */}
          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>Đã có tài khoản? </Text>
            <Pressable
              style={styles.loginLink}
              onPress={() => router.back()}
            >
              <Text style={styles.loginText}>Đăng nhập ngay</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
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
    paddingBottom: 36,
  },
  headerContainer: {
    position: 'relative',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  topRightDecorativeBlob: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 160,
    height: 160,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D56B81',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    shadowColor: '#D56B81',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#333333',
    letterSpacing: 0.5,
  },
  brandAccent: {
    color: '#D56B81',
  },
  sloganRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  logoTagline: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8A7B80',
    letterSpacing: 1.5,
  },
  sloganLine: {
    width: 24,
    height: 1,
    backgroundColor: '#B5A5AF',
    marginLeft: 6,
  },
  formContainer: {
    paddingHorizontal: 26,
    paddingTop: 10,
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
    marginBottom: 12,
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
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    marginBottom: 24,
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
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#D56B81',
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: '#5A4A52',
    marginLeft: 10,
    lineHeight: 20,
  },
  termsHighlight: {
    fontWeight: '700',
    color: '#D56B81',
  },
  registerButton: {
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
    marginBottom: 24,
  },
  registerButtonText: {
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
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#7C6C74',
  },
  loginLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#D56B81',
  },
});
