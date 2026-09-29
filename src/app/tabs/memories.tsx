import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../../constants/colors";

const memoryCards = [
  {
    id: 1,
    name: "Thenuga",
    location: "Vaithishvaran Nagar",
    date: "19 Sept",
    image:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80",
    accent: "#9DC4B2",
  },
  {
    id: 2,
    name: "Good",
    location: "Ambur",
    date: "17 Sept",
    image:
      "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80",
    accent: "#9FD6B5",
  },
];

export default function Memories() {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1" style={{ backgroundColor: "#EDF2F1" }}>
      <View
        className="px-5 pb-5 pt-4"
        style={{
          backgroundColor: "#0D1F2D",
          paddingTop: insets.top + 14,
        }}
      >
        <View className="mb-4 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="mr-3 h-12 w-12 items-center justify-center rounded-full bg-[#F4F6F4]">
              <Text className="text-[26px] font-black text-[#0D1F2D]">L</Text>
            </View>
            <Text className="text-[38px] font-bold text-white">LifeLedger</Text>
          </View>

          <View className="flex-row items-center">
            <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-[#F1F3F4]">
              <Ionicons name="notifications-outline" size={22} color="#1B2A34" />
              <View className="absolute -right-1 -top-1 h-5 w-5 items-center justify-center rounded-full bg-[#E64D4D]">
                <Text className="text-[10px] font-bold text-white">3</Text>
              </View>
            </View>

            <View className="h-12 w-12 items-center justify-center rounded-full bg-[#DFF4D8]">
              <Text className="text-[26px] font-bold text-[#0D1F2D]">D</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 18,
          paddingBottom: insets.bottom + 110,
        }}
      >
        <View className="mb-5 flex-row items-center rounded-[24px] border border-[#D5E1DD] bg-[#EAF1EE] px-4 py-3">
          <View className="mr-3 h-11 w-11 items-center justify-center rounded-full bg-[#D9EDE5]">
            <Ionicons name="search-outline" size={24} color="#1E3A34" />
          </View>

          <Text className="flex-1 text-[20px] text-[#56676A]">Search moments, places...</Text>

          <Pressable className="h-11 w-11 items-center justify-center rounded-full bg-[#E9F1EC]">
            <Ionicons name="options-outline" size={22} color="#1E3A34" />
          </Pressable>
        </View>

        <View className="flex-row flex-wrap justify-between">
          {memoryCards.map((card) => (
            <View
              key={card.id}
              className="mb-5 w-[48%] overflow-hidden rounded-[22px] border border-[#DEE7E5] bg-white"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 6,
                elevation: 2,
              }}
            >
              <View className="relative">
                <Image
                  source={{ uri: card.image }}
                  style={{ width: "100%", height: 200, resizeMode: "cover" }}
                />
                <Pressable
                  className="absolute right-3 top-3 h-8 w-8 items-center justify-center rounded-full bg-[#5D5D5D]/70"
                  accessibilityRole="button"
                >
                  <Ionicons name="close-outline" size={20} color="#FFFFFF" />
                </Pressable>
              </View>

              <View className="px-4 pb-4 pt-3">
                <Text className="text-[26px] font-bold text-[#1E2A2F]">
                  {card.name}
                </Text>

                <View className="mt-2 flex-row items-center">
                  <Ionicons name="location-outline" size={16} color="#4F6F66" />
                  <Text className="ml-2 text-[18px] text-[#475A60]">
                    {card.location}
                  </Text>
                </View>

                <Text className="mt-4 text-[18px] text-[#6A7376]">
                  {card.date} SEPT
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <Pressable
        className="absolute bottom-[110px] right-7 h-20 w-20 items-center justify-center rounded-full bg-[#0E5143]"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.2,
          shadowRadius: 10,
          elevation: 8,
        }}
        accessibilityRole="button"
      >
        <Ionicons name="add" size={48} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

