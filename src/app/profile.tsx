import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api, {
    getApiErrorMessage,
    getStoredUser,
    logoutUser,
    saveUser,
} from "../api";
import { FormInput, FormLabel } from "../components/FormControls";
import { GradientSafeAreaView as SafeAreaView } from "../components/GradientSafeAreaView";
import { CenteredPageLoader } from "../components/CenteredPageLoader";
import ConfirmPopup from "../components/ConfirmPopup";
import { Colors } from "../constants/colors";

type UserProfile = {
  id?: number | string;
  user_id?: number | string;
  name?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  role?: string;
  status?: string;
};

type PasswordKey = "current" | "next" | "confirm";
type PasswordState = Record<PasswordKey, string>;
type ProfileFormState = {
  name: string;
  email: string;
  phone: string;
};

const passwordFields: {
  key: PasswordKey;
  label: string;
  autoComplete: "current-password" | "new-password";
}[] = [
  {
    key: "current",
    label: "Current Password",
    autoComplete: "current-password",
  },
  { key: "next", label: "New Password", autoComplete: "new-password" },
  { key: "confirm", label: "Confirm Password", autoComplete: "new-password" },
];

function getDisplayName(user: UserProfile | null) {
  const fullName = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return (
    user?.name?.trim() ||
    fullName ||
    user?.username?.trim() ||
    user?.email ||
    "Admin User"
  );
}

function ProfileDetail({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View className="mb-3 flex-row items-center rounded-xl border border-[#E4E8E3] bg-white p-3.5">
      <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-[#EEF3EE]">
        <Ionicons name={icon} size={19} color="#315640" />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-xs font-bold uppercase tracking-[0.8px] text-[#839087]">
          {label}
        </Text>
        <Text
          className="mt-1 text-sm font-semibold text-[#293930]"
          numberOfLines={2}
        >
          {value || "Not provided"}
        </Text>
      </View>
    </View>
  );
}

export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    name: "",
    email: "",
    phone: "",
  });
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [showProfileSaveConfirmation, setShowProfileSaveConfirmation] =
    useState(false);
  const [showPasswordSaveConfirmation, setShowPasswordSaveConfirmation] =
    useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [profileStatus, setProfileStatus] = useState<{
    type: "success" | "error" | "";
    message: string;
  }>({ type: "", message: "" });
  const [passwords, setPasswords] = useState<PasswordState>({
    current: "",
    next: "",
    confirm: "",
  });
  const [visibleFields, setVisibleFields] = useState<
    Record<PasswordKey, boolean>
  >({
    current: false,
    next: false,
    confirm: false,
  });
  const [passwordStatus, setPasswordStatus] = useState<{
    type: "success" | "error" | "";
    message: string;
  }>({ type: "", message: "" });
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [savingPassword, setSavingPassword] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [showDeactivatePopup, setShowDeactivatePopup] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      void getStoredUser()
        .then((storedUser) => {
          if (active) {
            setUser(storedUser);
            setProfileForm({
              name: getDisplayName(storedUser),
              email: storedUser?.email || "",
              phone: storedUser?.phone || "",
            });
          }
        })
        .catch((error) => {
          if (active) {
            Alert.alert("Unable to load profile", getApiErrorMessage(error));
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [refreshKey]),
  );

  const profileName = getDisplayName(user);
  const profileEmail = user?.email || "Not provided";
  const profilePhone = user?.phone || "Not provided";
  const profileRole = user?.role || "Admin";
  const userId = user?.id || user?.user_id;

  const handleProfileSave = async () => {
    setProfileStatus({ type: "", message: "" });
    const name = profileForm.name.trim();
    const email = profileForm.email.trim();
    const phone = profileForm.phone.trim();

    if (!name) {
      setProfileStatus({ type: "error", message: "Name cannot be empty." });
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setProfileStatus({
        type: "error",
        message: "Enter a valid email address.",
      });
      return;
    }
    if (!userId) {
      setProfileStatus({
        type: "error",
        message: "Unable to identify your account. Please sign in again.",
      });
      return;
    }

    try {
      setSavingProfile(true);
      const response = await api.put(`/auth/profile/${userId}`, {
        username: name,
        email,
        phone,
      });
      const responseUser = response.data?.user as
        | Partial<UserProfile>
        | undefined;
      const updatedUser: UserProfile = {
        ...user,
        ...responseUser,
        name: responseUser?.name || name,
        username: responseUser?.username || name,
        email: responseUser?.email || email,
        phone: responseUser?.phone || phone,
      };
      await saveUser(updatedUser);
      setUser(updatedUser);
      setProfileForm({ name, email, phone });
      setEditingProfile(false);
      setProfileStatus({ type: "", message: "" });
      setSuccessMessage(response.data?.message || "Profile updated successfully.");
    } catch (error) {
      if ((error as { status?: number })?.status === 401) {
        await logoutUser();
        router.replace("/auth/login");
        return;
      }
      setProfileStatus({
        type: "error",
        message: getApiErrorMessage(
          error,
          "Unable to update profile. Please try again.",
        ),
      });
    } finally {
      setSavingProfile(false);
      setShowProfileSaveConfirmation(false);
    }
  };

  const cancelProfileEdit = () => {
    setProfileForm({
      name: profileName,
      email: user?.email || "",
      phone: user?.phone || "",
    });
    setProfileStatus({ type: "", message: "" });
    setEditingProfile(false);
  };

  const handlePasswordChange = async () => {
    setPasswordStatus({ type: "", message: "" });
    if (passwords.next.length < 6) {
      setPasswordStatus({
        type: "error",
        message: "New password must be at least 6 characters.",
      });
      return;
    }
    if (passwords.next !== passwords.confirm) {
      setPasswordStatus({
        type: "error",
        message: "New password and confirmation do not match.",
      });
      return;
    }
    if (!userId) {
      setPasswordStatus({
        type: "error",
        message: "Unable to identify your account. Please sign in again.",
      });
      return;
    }

    try {
      setSavingPassword(true);
      const response = await api.put(`/auth/profile/${userId}/password`, {
        currentPassword: passwords.current,
        newPassword: passwords.next,
      });
      setPasswords({ current: "", next: "", confirm: "" });
      setPasswordStatus({ type: "", message: "" });
      setSuccessMessage(response.data?.message || "Password changed successfully.");
    } catch (error) {
      if ((error as { status?: number })?.status === 401) {
        await logoutUser();
        router.replace("/auth/login");
        return;
      }
      setPasswordStatus({
        type: "error",
        message: getApiErrorMessage(
          error,
          "Unable to change password. Please try again.",
        ),
      });
    } finally {
      setSavingPassword(false);
      setShowPasswordSaveConfirmation(false);
    }
  };

  const deactivateAccount = async () => {
    if (!userId) {
      setPasswordStatus({
        type: "error",
        message: "Unable to identify your account. Please sign in again.",
      });
      return;
    }
    try {
      setDeactivating(true);
      await api.patch(`/auth/users/${userId}/status`, { status: "Inactive" });
      await logoutUser();
      router.replace("/auth/login");
    } catch (error) {
      if ((error as { status?: number })?.status === 401) {
        await logoutUser();
        router.replace("/auth/login");
        return;
      }
      setPasswordStatus({
        type: "error",
        message: getApiErrorMessage(
          error,
          "Unable to deactivate your account.",
        ),
      });
    } finally {
      setDeactivating(false);
    }
  };

  const confirmDeactivation = () => {
    setShowDeactivatePopup(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F2F5EA]" edges={["bottom"]}>
      <ConfirmPopup
        visible={showDeactivatePopup}
        type="delete"
        title="Deactivate account?"
        message="Your account details will be kept, but you will no longer be able to log in."
        confirmText="Deactivate"
        destructive
        loading={deactivating}
        onConfirm={deactivateAccount}
        onCancel={() => setShowDeactivatePopup(false)}
      />
      <ConfirmPopup
        visible={showProfileSaveConfirmation}
        type="edit"
        loading={savingProfile}
        onConfirm={async () => {
          await handleProfileSave();
          setShowProfileSaveConfirmation(false);
        }}
        onCancel={() => setShowProfileSaveConfirmation(false)}
      />
      <ConfirmPopup
        visible={showPasswordSaveConfirmation}
        type="save"
        loading={savingPassword}
        onConfirm={async () => {
          await handlePasswordChange();
          setShowPasswordSaveConfirmation(false);
        }}
        onCancel={() => setShowPasswordSaveConfirmation(false)}
      />
      <ConfirmPopup
        visible={successMessage !== null}
        type="success"
        message={successMessage ?? ""}
        onConfirm={() => setSuccessMessage(null)}
      />
      <LinearGradient
        colors={Colors.greenGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingHorizontal: 16,
          paddingBottom: 16,
          paddingTop: insets.top + 8,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="h-10 w-10 items-center justify-center rounded-full bg-white/15"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/tabs/more");
          }}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.white} />
        </Pressable>
        <Text className="ml-3 text-lg font-bold text-white">My Profile</Text>
      </LinearGradient>

      {loading ? (
        <CenteredPageLoader message="Loading profile..." />
      ) : (
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => setRefreshKey((current) => current + 1)}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 36 }}
      >
        <View className="mb-5 mt-6 overflow-hidden rounded-2xl bg-[#315640] p-5">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-bold uppercase tracking-[1.4px] text-white/75">
              Life Ledger
            </Text>
            <Ionicons
              name="shield-checkmark-outline"
              size={21}
              color="#DDEBDD"
            />
          </View>
          <View className="mt-6 flex-row items-center">
            <View className="mr-4 h-16 w-16 items-center justify-center rounded-2xl bg-white">
              <Text className="text-3xl font-extrabold text-[#315640]">
                {profileName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="min-w-0 flex-1">
              <Text
                className="text-2xl font-extrabold text-white"
                numberOfLines={2}
              >
                {profileName}
              </Text>
              <Text className="mt-1 text-xs font-bold uppercase tracking-[1.2px] text-white/70">
                {profileRole}
              </Text>
            </View>
          </View>
          <View className="mt-5 flex-row items-center">
            <View className="mr-2 h-2 w-2 rounded-full bg-[#B7E3A2]" />
            <Text className="text-xs font-semibold text-white/85">
              {user?.status === "Inactive"
                ? "Account inactive"
                : "Account active"}
            </Text>
          </View>
        </View>

        <View className="mb-5 rounded-2xl border border-[#E4E8E3] bg-[#F5F6F2]">
          <View className="mb-3 flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-xs font-bold uppercase tracking-[1.2px] text-[#839087]">
                Personal details
              </Text>
              <Text className="mt-1 text-xl font-bold text-[#293930]">
                Account information
              </Text>
            </View>
            <View className="flex-row items-center">
              {!editingProfile && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit profile details"
                  disabled={loading || savingProfile}
                  onPress={() => {
                    setProfileStatus({ type: "", message: "" });
                    setEditingProfile(true);
                  }}
                  className="ml-2 h-10 w-10 items-center justify-center rounded-full bg-white"
                >
                  <Ionicons name="create-outline" size={19} color="#315640" />
                </Pressable>
              )}
            </View>
          </View>
          {editingProfile ? (
            <>
              {[
                {
                  key: "name" as const,
                  label: "Full Name",
                  icon: "person-outline" as const,
                  keyboardType: "default" as const,
                  autoCapitalize: "words" as const,
                },
                {
                  key: "email" as const,
                  label: "Email Address",
                  icon: "mail-outline" as const,
                  keyboardType: "email-address" as const,
                  autoCapitalize: "none" as const,
                },
                {
                  key: "phone" as const,
                  label: "Phone Number",
                  icon: "call-outline" as const,
                  keyboardType: "phone-pad" as const,
                  autoCapitalize: "none" as const,
                },
              ].map((field) => (
                <View
                  key={field.key}
                  className="mb-4 flex-row items-center rounded-xl border border-[#E4E8E3] bg-white px-3"
                >
                  <Ionicons
                    name={field.icon}
                    size={19}
                    color="#315640"
                    style={{ marginRight: 12 }}
                  />
                  <View className="flex-1 py-2">
                    <FormLabel color="#839087">
                      {field.label}
                    </FormLabel>
                    <FormInput
                      bordered={false}
                      accessibilityLabel={field.label}
                      autoCapitalize={field.autoCapitalize}
                      autoCorrect={false}
                      keyboardType={field.keyboardType}
                      onChangeText={(value) => {
                        setProfileForm((current) => ({
                          ...current,
                          [field.key]: value,
                        }));
                        setProfileStatus({ type: "", message: "" });
                      }}
                      value={profileForm[field.key]}
                      className="min-h-9 p-0 text-sm font-semibold text-[#293930]"
                    />
                  </View>
                </View>
              ))}
              {!!profileStatus.message && (
                <Text
                  accessibilityLiveRegion="polite"
                  className={`mb-3 text-xs font-semibold ${profileStatus.type === "error" ? "text-[#B64C45]" : "text-[#25805A]"}`}
                >
                  {profileStatus.message}
                </Text>
              )}
              <View className="flex-row gap-3">
                <Pressable
                  accessibilityRole="button"
                  disabled={savingProfile}
                  onPress={cancelProfileEdit}
                  className="flex-1 items-center justify-center rounded-xl border border-[#DCE4DC] bg-white py-3"
                >
                  <Text className="text-sm font-bold text-[#526058]">
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={savingProfile}
                  onPress={() => setShowProfileSaveConfirmation(true)}
                  className={`flex-1 flex-row items-center justify-center rounded-xl bg-[#315640] py-3 ${savingProfile ? "opacity-60" : ""}`}
                >
                  {savingProfile ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark-outline"
                        size={17}
                        color="#FFFFFF"
                      />
                      <Text className="ml-2 text-sm font-bold text-white">
                        Save changes
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <ProfileDetail
                icon="person-outline"
                label="Full name"
                value={profileName}
              />
              <ProfileDetail
                icon="mail-outline"
                label="Email address"
                value={profileEmail}
              />
              <ProfileDetail
                icon="call-outline"
                label="Phone number"
                value={profilePhone}
              />
            </>
          )}
          <ProfileDetail
            icon="shield-checkmark-outline"
            label="Role"
            value={profileRole}
          />
        </View>

        <View className="mb-5 rounded-2xl border border-[#E4E8E3] bg-white p-4">
          <View className="mb-4 flex-row items-center">
            <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-[#315640]">
              <Ionicons name="lock-closed-outline" size={19} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-bold uppercase tracking-[1px] text-[#839087]">
                Security
              </Text>
              <Text className="mt-0.5 text-xl font-bold text-[#293930]">
                Change password
              </Text>
            </View>
          </View>
          <Text className="mb-4 text-xs leading-5 text-[#738077]">
            Use a new password with at least 6 characters.
          </Text>

          {passwordFields.map((field) => (
            <View key={field.key} className="mb-4">
              <FormLabel color="#526058">
                {field.label}
              </FormLabel>
              <View className="flex-row items-center rounded-xl border border-[#E5EAE7] bg-[#F9FAF8] px-3">
                <FormInput
                  bordered={false}
                  accessibilityLabel={field.label}
                  autoComplete={field.autoComplete}
                  className="h-12 flex-1 text-sm text-[#293930]"
                  onChangeText={(value) => {
                    setPasswords((current) => ({
                      ...current,
                      [field.key]: value,
                    }));
                    setPasswordStatus({ type: "", message: "" });
                  }}
                  placeholder={field.label}
                  secureTextEntry={!visibleFields[field.key]}
                  value={passwords[field.key]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${visibleFields[field.key] ? "Hide" : "Show"} ${field.label.toLowerCase()}`}
                  className="h-9 w-9 items-center justify-center"
                  onPress={() =>
                    setVisibleFields((current) => ({
                      ...current,
                      [field.key]: !current[field.key],
                    }))
                  }
                >
                  <Ionicons
                    name={
                      visibleFields[field.key]
                        ? "eye-off-outline"
                        : "eye-outline"
                    }
                    size={18}
                    color="#7F8A82"
                  />
                </Pressable>
              </View>
            </View>
          ))}

          {!!passwordStatus.message && (
            <Text
              accessibilityLiveRegion="polite"
              className={`mb-3 text-xs font-semibold ${passwordStatus.type === "error" ? "text-[#B64C45]" : "text-[#25805A]"}`}
            >
              {passwordStatus.message}
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            className={`flex-row items-center justify-center rounded-xl bg-[#315640] py-3.5 ${savingPassword || !passwords.current || !passwords.next || !passwords.confirm ? "opacity-50" : ""}`}
            disabled={
              savingPassword ||
              !passwords.current ||
              !passwords.next ||
              !passwords.confirm
            }
            onPress={() => setShowPasswordSaveConfirmation(true)}
          >
            {savingPassword ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name="lock-closed-outline"
                  size={16}
                  color="#FFFFFF"
                />
                <Text className="ml-2 text-sm font-bold text-white">
                  Update password
                </Text>
              </>
            )}
          </Pressable>
        </View>

        <View className="rounded-2xl border border-[#F1D7D5] bg-[#FFF6F5] p-4">
          <Text className="text-xs font-bold uppercase tracking-[1.2px] text-[#B64C45]">
            Danger zone
          </Text>
          <Text className="mt-1 text-lg font-bold text-[#293930]">
            Deactivate account
          </Text>
          <Text className="mt-1 text-xs leading-5 text-[#778179]">
            Your account details will be retained, but you will no longer be
            able to log in.
          </Text>
          <Pressable
            accessibilityRole="button"
            className={`mt-4 flex-row items-center justify-center rounded-xl border border-[#E9C6C3] bg-white py-3 ${deactivating ? "opacity-50" : ""}`}
            disabled={deactivating}
            onPress={confirmDeactivation}
          >
            {deactivating ? (
              <ActivityIndicator color="#B64C45" />
            ) : (
              <>
                <Ionicons
                  name="person-remove-outline"
                  size={17}
                  color="#B64C45"
                />
                <Text className="ml-2 text-sm font-bold text-[#B64C45]">
                  Deactivate account
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
      )}
    </SafeAreaView>
  );
}
