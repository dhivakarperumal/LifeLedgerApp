import { User } from "lucide-react-native";
import { useState } from "react";
import { Image, Text } from "react-native";

export type UserWithProfileImage = {
  name?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  email?: string;
  profile_image?: string;
  profile_image_url?: string;
  profile_picture?: string;
  profile_picture_url?: string;
  profile_photo?: string;
  profile_photo_url?: string;
  profileImage?: string;
  avatar?: string;
  avatar_url?: string;
  image?: string;
};

export function getProfileImageUri(user: UserWithProfileImage | null) {
  return (
    user?.profile_image_url ||
    user?.profile_image ||
    user?.profile_picture_url ||
    user?.profile_picture ||
    user?.profile_photo_url ||
    user?.profile_photo ||
    user?.profileImage ||
    user?.avatar_url ||
    user?.avatar ||
    user?.image ||
    null
  );
}

export function getProfileInitial(user: UserWithProfileImage | null) {
  const fullName = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const displayName =
    user?.name?.trim() ||
    fullName ||
    user?.username?.trim() ||
    user?.email?.trim() ||
    "";

  return displayName.charAt(0).toUpperCase() || null;
}

export function ProfileAvatar({
  imageUri,
  initial,
  size,
  iconColor,
}: {
  imageUri: string | null;
  initial: string | null;
  size: number;
  iconColor: string;
}) {
  const [failedImageUri, setFailedImageUri] = useState<string | null>(null);

  if (imageUri && failedImageUri !== imageUri) {
    return (
      <Image
        source={{ uri: imageUri }}
        style={{ width: size, height: size }}
        resizeMode="cover"
        onError={() => setFailedImageUri(imageUri)}
        accessibilityLabel="Profile image"
      />
    );
  }

  if (initial) {
    return (
      <Text
        style={{
          color: iconColor,
          fontSize: size * 0.5,
          fontWeight: "700",
        }}
      >
        {initial}
      </Text>
    );
  }

  return <User size={size * 0.52} color={iconColor} strokeWidth={2.2} />;
}