import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api, { getApiErrorMessage } from "../api";
import { AddPageHeader } from "../components/AddPageHeader";
import { DateTimePickerComponent } from "../components/DateTimePickerComponent";
import { PopupSelect } from "../components/PopupSelect";
import { Colors } from "../constants/colors";

type TaskStatus = "Pending" | "In Progress" | "Completed";
type TaskPriority = "High" | "Medium" | "Low";

type TaskForm = {
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  dueTime: string;
  reminderAt: string;
};

const STATUSES: TaskStatus[] = ["Pending", "In Progress", "Completed"];
const PRIORITIES: TaskPriority[] = ["High", "Medium", "Low"];

function paramValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateTimeKey(date: Date) {
  return `${dateKey(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function parseDate(value?: string) {
  if (!value) return null;
  const normalized = value.trim().replace(" ", "T");
  const date = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(normalized)
      ? `${normalized}T00:00:00`
      : normalized,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function FieldLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        marginBottom: 7,
        color: "#526071",
        fontSize: 13,
        fontWeight: "700",
      }}
    >
      {children}
    </Text>
  );
}

const inputStyle = {
  minHeight: 48,
  paddingHorizontal: 13,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: "#DDE2E8",
  color: "#253044",
  fontSize: 14,
  backgroundColor: "white",
};

export default function TodoFormPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id?: string | string[];
    title?: string | string[];
    description?: string | string[];
    priority?: string | string[];
    status?: string | string[];
    dueDate?: string | string[];
    dueTime?: string | string[];
    reminderAt?: string | string[];
  }>();
  const taskId = paramValue(params.id);
  const isEditing = Boolean(taskId);
  const [form, setForm] = useState<TaskForm>(() => {
    const requestedPriority = paramValue(params.priority);
    const requestedStatus = paramValue(params.status);
    return {
      title: paramValue(params.title) ?? "",
      description: paramValue(params.description) ?? "",
      priority: PRIORITIES.includes(requestedPriority as TaskPriority)
        ? (requestedPriority as TaskPriority)
        : "Medium",
      status: STATUSES.includes(requestedStatus as TaskStatus)
        ? (requestedStatus as TaskStatus)
        : "Pending",
      dueDate: paramValue(params.dueDate)?.slice(0, 10) ?? "",
      dueTime:
        paramValue(params.dueTime) ??
        paramValue(params.dueDate)?.slice(11, 16) ??
        "",
      reminderAt: paramValue(params.reminderAt) ?? "",
    };
  });
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [titleError, setTitleError] = useState("");
  const saveInFlight = useRef(false);

  const updateForm = <K extends keyof TaskForm>(key: K, value: TaskForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrorMessage("");
    if (key === "title" && String(value).trim()) setTitleError("");
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/todos");
  };

  const saveTask = async () => {
    if (saveInFlight.current) return;
    if (!form.title.trim()) {
      setTitleError("Task title is required.");
      setErrorMessage("");
      return;
    }

    saveInFlight.current = true;
    setSaving(true);
    setErrorMessage("");
    setTitleError("");
    try {
      const { dueTime, ...fields } = form;
      const payload = {
        ...fields,
        title: form.title.trim(),
        description: form.description.trim(),
        dueDate: form.dueDate
          ? `${form.dueDate}${dueTime ? `T${dueTime}` : ""}`
          : null,
        reminderAt: form.reminderAt || null,
      };
      const response = isEditing
        ? await api.put(`/todos/${taskId}`, payload)
        : await api.post("/todos", payload);
      const savedTask = response.data?.data as { id?: number | string } | undefined;
      if (!savedTask || savedTask.id === undefined) {
        throw new Error(
          isEditing
            ? "The server did not return the updated task."
            : "The server did not return the new task.",
        );
      }
      router.back();
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, "Unable to save this task. Please try again."),
      );
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F2F5EA" }}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Colors.greenGradient[0]}
        translucent={false}
      />
      <AddPageHeader
        title={isEditing ? "Edit To Do" : "Add New To Do"}
        onBack={goBack}
        horizontalInset={24}
        disabled={saving}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            width: "100%",
            maxWidth: 680,
            alignSelf: "center",
            paddingHorizontal: 16,
            paddingTop: 18,
            paddingBottom: 24,
          }}
        >
          <View>
            <FieldLabel>Task Title *</FieldLabel>
            <TextInput
              accessibilityLabel="Task title, required"
              accessibilityHint={titleError || undefined}
              value={form.title}
              onChangeText={(value) => updateForm("title", value)}
              placeholder="What needs to get done?"
              placeholderTextColor="#9AA3AF"
              maxLength={255}
              returnKeyType="next"
              style={inputStyle}
            />
            {titleError ? (
              <Text
                accessibilityRole="alert"
                style={{ marginTop: 6, color: "#A13F3F", fontSize: 12 }}
              >
                {titleError}
              </Text>
            ) : null}

            <View style={{ marginTop: 16 }}>
              <FieldLabel>Description / Notes</FieldLabel>
              <TextInput
                accessibilityLabel="Description or notes"
                value={form.description}
                onChangeText={(value) => updateForm("description", value)}
                placeholder="Add any helpful details..."
                placeholderTextColor="#9AA3AF"
                multiline
                textAlignVertical="top"
                style={[inputStyle, { minHeight: 92, paddingTop: 12 }]}
              />
            </View>

            <View style={{ marginTop: 16 }}>
              <FieldLabel>Due Date</FieldLabel>
              <DateTimePickerComponent
                mode="date"
                value={parseDate(form.dueDate)}
                placeholder="Select due date"
                onChange={(date) => {
                  const nextDueDate = date ? dateKey(date) : "";
                  updateForm("dueDate", nextDueDate);
                  if (!nextDueDate) updateForm("dueTime", "");
                }}
              />
              {form.dueDate ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    updateForm("dueDate", "");
                    updateForm("dueTime", "");
                  }}
                  style={{ alignSelf: "flex-end", marginTop: -5, paddingVertical: 5 }}
                >
                  <Text style={{ color: "#7A5A93", fontSize: 11, fontWeight: "700" }}>
                    Clear due date
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <View style={{ marginTop: 16 }}>
              <PopupSelect
                label="Priority"
                placeholder="Select priority"
                options={PRIORITIES}
                value={form.priority}
                onChange={(value) =>
                  updateForm("priority", value as TaskPriority)
                }
              />
            </View>

            <View style={{ marginTop: 16 }}>
              <PopupSelect
                label="Status"
                placeholder="Select status"
                options={STATUSES}
                value={form.status}
                onChange={(value) => updateForm("status", value as TaskStatus)}
              />
            </View>

            <View style={{ marginTop: 16 }}>
              <FieldLabel>Reminder</FieldLabel>
              <DateTimePickerComponent
                mode="datetime"
                value={parseDate(form.reminderAt)}
                placeholder="No reminder set"
                onChange={(date) =>
                  updateForm("reminderAt", date ? dateTimeKey(date) : "")
                }
              />
              {form.reminderAt ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => updateForm("reminderAt", "")}
                  style={{ alignSelf: "flex-end", marginTop: -5, paddingVertical: 5 }}
                >
                  <Text style={{ color: "#7A5A93", fontSize: 11, fontWeight: "700" }}>
                    Clear reminder
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {errorMessage ? (
              <View
                accessibilityRole="alert"
                style={{
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#F1D3D3",
                  backgroundColor: "#FFF1F1",
                }}
              >
                <Text style={{ color: "#A13F3F", fontSize: 12, lineHeight: 17 }}>
                  {errorMessage}
                </Text>
              </View>
            ) : null}
          </View>
        </ScrollView>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "flex-end",
            gap: 10,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 12),
            borderTopWidth: 1,
            borderTopColor: "#E5E9EF",
            backgroundColor: Colors.white,
          }}
        >
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={goBack}
            style={{
              minHeight: 46,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 17,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#DDE2E8",
            }}
          >
            <Text style={{ color: "#637083", fontSize: 13, fontWeight: "800" }}>
              Cancel
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: saving, busy: saving }}
            disabled={saving}
            onPress={() => void saveTask()}
            style={{
              minHeight: 46,
              minWidth: 150,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              paddingHorizontal: 16,
              borderRadius: 12,
              backgroundColor: Colors.primary,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons
                name={isEditing ? "checkmark" : "add"}
                size={18}
                color="white"
              />
            )}
            <Text style={{ color: "white", fontSize: 13, fontWeight: "900" }}>
              {saving ? "Saving..." : isEditing ? "Save changes" : "Save To Do"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
