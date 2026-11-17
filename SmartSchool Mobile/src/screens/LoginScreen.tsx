import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { apiRequest } from '../api/client';
import { ConstellationBackground } from '../components/ConstellationBackground';

interface LoginScreenProps {
  onLoginSuccess?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const { setUser, setSchool, setTenantSlug, setSchoolContext } = useAuthStore();

  // Mode & Step state
  const [authMode, setAuthMode] = useState<'username' | 'phone'>('username');
  const [step, setStep] = useState<1 | 2>(1);
  const [identifier, setIdentifier] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isIdentifierFocused, setIsIdentifierFocused] = useState<boolean>(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState<boolean>(false);

  // Keyboard state & scroll ref
  const [isKeyboardVisible, setIsKeyboardVisible] = useState<boolean>(false);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);
  const scrollViewRef = useRef<any>(null);

  const scrollToInput = (yOffset = 100) => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: yOffset, animated: true });
    }, 120);
  };

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setIsKeyboardVisible(true);
      const h = e?.endCoordinates?.height || 280;
      setKeyboardHeight(h);
      scrollToInput(step === 1 ? 100 : 120);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [step]);

  // Data returned from step 1 lookup
  const [schoolName, setSchoolName] = useState<string>('School Portal');
  const [userName, setUserName] = useState<string>('Staff Account');
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string>('');
  const [userType, setUserType] = useState<string>('staff');

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Step 1: Lookup Phone / Email / Username
  const handleLookup = async () => {
    const cleanId = identifier.trim();
    if (!cleanId) {
      setErrorMessage(
        authMode === 'phone'
          ? 'Please enter your registered phone number.'
          : 'Please enter your username or email address.'
      );
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await apiRequest('/login/lookup', {
        method: 'POST',
        body: JSON.stringify({ identifier: cleanId }),
      });

      if (res.status === 'password_required') {
        setSchoolName(res.school_name || 'School Portal');
        setUserName(res.user_name || res.display_identifier || cleanId);
        setSchoolLogo(res.school_logo || null);
        setTenantId(res.tenant_id || res.school_slug || '');
        setUserType(res.user_type || 'staff');
        setStep(2);
      } else {
        setErrorMessage(res.message || 'No staff account found matching that identifier.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Connection error. Please check your network and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Authenticate Password & Load Live School Context
  const handleAuthenticate = async () => {
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const authRes = await apiRequest('/login/authenticate', {
        method: 'POST',
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
          user_type: userType,
          tenant_id: tenantId,
          remember: 1,
        }),
      });

      if (authRes.success) {
        const activeTenant = tenantId || authRes.tenant_id || '';
        setTenantSlug(activeTenant);

        let schoolData: any = null;
        try {
          schoolData = await apiRequest(`/${activeTenant}/mobile?format=json`);
        } catch (fetchErr) {
          console.warn('Initial data load warning:', fetchErr);
        }

        if (schoolData && schoolData.success) {
          setUser({
            id: schoolData.user?.id || 1,
            name: schoolData.user?.name || userName,
            surname: schoolData.user?.surname || '',
            email: schoolData.user?.email || identifier,
            role: schoolData.user?.role || 'Teaching Staff',
          });

          setSchool({
            id: schoolData.school?.id || 1,
            name: schoolData.schoolName || schoolName,
            slug: activeTenant,
            logoUrl: schoolData.schoolLogo || schoolLogo || undefined,
          });

          setSchoolContext({
            schoolClasses: schoolData.classes || [],
            assignedSubjects: schoolData.assigned_subjects || [],
            terms: schoolData.terms || [],
            activeTerm: schoolData.active_term || null,
            isPrimary: !!schoolData.is_primary,
            learnerLabel: schoolData.learner_label || 'Student',
            learnersLabel: schoolData.learners_label || 'Students',
            isAdmin: !!schoolData.is_admin,
            totalStudents: schoolData.total_students || 0,
            totalMale: schoolData.total_male || 0,
            totalFemale: schoolData.total_female || 0,
            totalDay: schoolData.total_day || 0,
            totalBoarding: schoolData.total_boarding || 0,
            totalClassesCount: schoolData.total_classes_count || 0,
            totalStreamsCount: schoolData.total_streams_count || 0,
            totalSubjectsCount: schoolData.total_subjects_count || 0,
            totalStaffCount: schoolData.total_staff_count || 0,
            totalMarksRecorded: schoolData.total_marks_recorded || 0,
            todayPresent: schoolData.today_present || 0,
            todayAbsent: schoolData.today_absent || 0,
            todayLate: schoolData.today_late || 0,
            todayTotal: schoolData.today_total || 0,
            todayClassesCount: schoolData.today_classes_count || 0,
            todayAttendanceByClass: schoolData.today_attendance_by_class || [],
            classBreakdown: schoolData.class_breakdown || [],
            timetableSlots: schoolData.timetable_slots || [],
            announcements: schoolData.notifications || [],
            unreadCount: schoolData.unread_count || 0,
          });
        } else {
          setUser({
            id: 1,
            name: userName,
            surname: '',
            email: identifier,
            role: 'Teaching Staff',
          });
          setSchool({
            id: 1,
            name: schoolName,
            slug: activeTenant,
            logoUrl: schoolLogo || undefined,
          });
        }

        if (onLoginSuccess) {
          onLoginSuccess();
        }
      } else {
        setErrorMessage(authRes.message || 'Incorrect password. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication error. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. White Animated Constellation Background (Pointer events disabled) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <ConstellationBackground />
      </View>

      {/* 2. Top-Left Build Version Badge */}
      <View style={styles.topVersionTag} pointerEvents="none">
        <Text style={styles.topVersionText}>XulIQ v3.5.6</Text>
      </View>

      {/* 3. Keyboard-Aware Scroll View */}
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContent,
            isKeyboardVisible && [
              styles.scrollContentKeyboardActive,
              { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 80 : 380 },
            ],
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Main Centered Card Wrapper */}
          <View style={styles.cardWrap}>
            {/* Brand App Icon Crest: Bulb icon inside rounded squircle */}
            <View style={[styles.crestBadgeWrap, isKeyboardVisible && { marginBottom: 4 }]}>
              <View style={[styles.crestBadge, isKeyboardVisible && styles.crestBadgeCompact]}>
                <Ionicons
                  name="bulb-outline"
                  size={isKeyboardVisible ? 24 : 32}
                  color="#ffffff"
                />
              </View>
            </View>

            {/* Headlines */}
            <Text style={[styles.mainTitle, isKeyboardVisible && styles.mainTitleCompact]}>
              Welcome to XulIQ
            </Text>
            <Text style={[styles.mainSubtitle, isKeyboardVisible && styles.mainSubtitleCompact]}>
              School Management System
            </Text>

            {/* Frosted Dark Glassmorphism Card */}
            <View style={[styles.authGlassCard, isKeyboardVisible && styles.authGlassCardCompact]}>
              {/* Alert Message Box */}
              {errorMessage && (
                <View style={styles.alertBox}>
                  <Ionicons name="alert-circle" size={17} color="#ef4444" />
                  <Text style={styles.alertText}>{errorMessage}</Text>
                </View>
              )}

              {/* STEP 1: Segmented Pill Switcher & Identity Lookup */}
              {step === 1 ? (
                <View style={styles.formView}>
                  {/* Dual Tab Segmented Switcher [ Username | Phone ] */}
                  <View style={styles.segmentedWrap}>
                    <TouchableOpacity
                      style={[
                        styles.segmentTab,
                        authMode === 'username' && styles.segmentTabActive,
                      ]}
                      onPress={() => {
                        setAuthMode('username');
                        setErrorMessage(null);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          authMode === 'username' && styles.segmentTextActive,
                        ]}
                      >
                        Username
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.segmentTab,
                        authMode === 'phone' && styles.segmentTabActive,
                      ]}
                      onPress={() => {
                        setAuthMode('phone');
                        setErrorMessage(null);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          authMode === 'phone' && styles.segmentTextActive,
                        ]}
                      >
                        Phone
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Form Field */}
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>
                      {authMode === 'phone' ? 'PHONE NUMBER' : 'USERNAME'}
                    </Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        isIdentifierFocused && styles.inputWrapperFocused,
                      ]}
                    >
                      <Ionicons
                        name={authMode === 'phone' ? 'call-outline' : 'person-outline'}
                        size={18}
                        color={isIdentifierFocused ? '#38bdf8' : '#94a3b8'}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.textInput}
                        value={identifier}
                        onFocus={() => {
                          setIsIdentifierFocused(true);
                          scrollToInput(100);
                        }}
                        onBlur={() => setIsIdentifierFocused(false)}
                        onChangeText={(val) => {
                          setIdentifier(val);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        placeholder={
                          authMode === 'phone'
                            ? 'Enter your phone number'
                            : 'Enter your username'
                        }
                        placeholderTextColor="rgba(255, 255, 255, 0.45)"
                        selectionColor="#38bdf8"
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType={authMode === 'phone' ? 'phone-pad' : 'email-address'}
                      />
                    </View>
                  </View>

                  {/* Continue Action Button */}
                  <TouchableOpacity
                    style={styles.btnAction}
                    onPress={handleLookup}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={styles.btnActionText}>Continue</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                /* STEP 2: Recognized School Badge & Password Input */
                <View style={styles.formView}>
                  {/* Recognized School Context Badge */}
                  <View style={styles.matchedSchoolBadge}>
                    <View style={styles.badgeLeft}>
                      {schoolLogo ? (
                        <Image source={{ uri: schoolLogo }} style={styles.badgeLogo} resizeMode="contain" />
                      ) : (
                        <View style={styles.badgeLogoPlaceholder}>
                          <Ionicons name="school" size={20} color="#38bdf8" />
                        </View>
                      )}
                      <View style={styles.badgeTextWrap}>
                        <Text style={styles.badgeSchoolName} numberOfLines={1}>
                          {schoolName}
                        </Text>
                        <Text style={styles.badgeUserName} numberOfLines={1}>
                          {userName}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.btnSwitchAccount}
                      onPress={() => {
                        setStep(1);
                        setPassword('');
                        setErrorMessage(null);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.btnSwitchText}>Switch</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Password Field */}
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>PASSWORD</Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        isPasswordFocused && styles.inputWrapperFocused,
                      ]}
                    >
                      <Ionicons
                        name="lock-closed-outline"
                        size={18}
                        color={isPasswordFocused ? '#38bdf8' : '#94a3b8'}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        key={showPassword ? 'pwd-text' : 'pwd-masked'}
                        style={styles.textInput}
                        value={password}
                        onFocus={() => {
                          setIsPasswordFocused(true);
                          scrollToInput(120);
                        }}
                        onBlur={() => setIsPasswordFocused(false)}
                        onChangeText={(val) => {
                          setPassword(val);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        placeholder="Enter your account password"
                        placeholderTextColor="rgba(255, 255, 255, 0.45)"
                        selectionColor="#38bdf8"
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        spellCheck={false}
                        textContentType={showPassword ? 'none' : 'password'}
                        autoComplete={showPassword ? 'off' : 'password'}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword((prev) => !prev)}
                        style={styles.eyeBtn}
                        activeOpacity={0.7}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      >
                        <Ionicons
                          name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                          size={19}
                          color={showPassword ? '#38bdf8' : '#94a3b8'}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Sign In Button */}
                  <TouchableOpacity
                    style={[styles.btnAction, styles.btnActionSignIn]}
                    onPress={handleAuthenticate}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={styles.btnActionText}>Sign In</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Below-Card Help Note */}
            <Text style={styles.helpNoteText}>
              Forgot your {authMode === 'phone' ? 'phone number' : 'username'}? Contact your administrator.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 4. Bottom Screen Footer: Stays in place and hidden when keypad is active */}
      {!isKeyboardVisible && (
        <View style={styles.screenFooter}>
          <Text style={styles.footerPoweredText}>
            Powered by <Text style={styles.footerBold}>Niair Platforms</Text>
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://www.xuliq.com')}
            activeOpacity={0.7}
          >
            <Text style={styles.footerLinkText}>
              Visit <Text style={styles.footerLinkUnderline}>www.xuliq.com</Text> for more information.
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#11221f',
    position: 'relative',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 45,
    paddingBottom: 75, // Leaves clean space for bottom footer
  },
  scrollContentKeyboardActive: {
    paddingTop: 12,
    justifyContent: 'flex-start',
  },
  topVersionTag: {
    position: 'absolute',
    top: 52,
    left: 22,
    zIndex: 10,
  },
  topVersionText: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  crestBadgeCompact: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginBottom: 2,
  },
  crestImgCompact: {
    width: 28,
    height: 28,
  },
  mainTitleCompact: {
    fontSize: 19,
    marginBottom: 2,
  },
  mainSubtitleCompact: {
    fontSize: 12,
    marginBottom: 10,
  },
  authGlassCardCompact: {
    padding: 16,
  },
  cardWrap: {
    width: '100%',
    maxWidth: 385,
    alignItems: 'center',
  },
  crestBadgeWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  crestBadge: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  crestImg: {
    width: 34,
    height: 34,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  mainSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.72)',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '400',
  },
  authGlassCard: {
    width: '100%',
    padding: 22,
    borderRadius: 20,
    backgroundColor: 'rgba(24, 38, 36, 0.74)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 6,
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  alertText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },
  formView: {
    width: '100%',
  },
  segmentedWrap: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    padding: 3,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  segmentTabActive: {
    backgroundColor: '#94a3b8',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#0f172a',
    fontWeight: '700',
  },
  formGroup: {
    marginBottom: 18,
  },
  formLabel: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 7,
    letterSpacing: 0.8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  inputWrapperFocused: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    height: '100%',
    color: '#ffffff',
    fontSize: 14,
  },
  eyeBtn: {
    padding: 6,
  },
  btnAction: {
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  btnActionSignIn: {
    backgroundColor: '#0d9488',
    borderColor: '#14b8a6',
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  btnActionText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  matchedSchoolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    marginBottom: 18,
  },
  badgeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  badgeLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    marginRight: 10,
  },
  badgeLogoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  badgeTextWrap: {
    flex: 1,
  },
  badgeSchoolName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  badgeUserName: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 11,
    marginTop: 2,
  },
  btnSwitchAccount: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  btnSwitchText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  helpNoteText: {
    marginTop: 18,
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  screenFooter: {
    position: 'absolute',
    bottom: 22,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  footerPoweredText: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 12,
    marginBottom: 4,
  },
  footerBold: {
    color: '#ffffff',
    fontWeight: '700',
  },
  footerLinkText: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 12,
  },
  footerLinkUnderline: {
    color: '#ffffff',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
