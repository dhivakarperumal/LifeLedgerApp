import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api, { getApiErrorMessage } from "../api";
import { AddButton } from "../components/AddButton";
import { AddPageHeader } from "../components/AddPageHeader";
import ConfirmPopup from "../components/ConfirmPopup";
import { Colors } from "../constants/colors";

type TaskStatus = "Pending" | "In Progress" | "Completed";
type TaskPriority = "High" | "Medium" | "Low";

type TodoTask = {
  id: number | string;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string | null;
  reminderAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

const STATUSES: TaskStatus[] = ["Pending", "In Progress", "Completed"];
const PRIORITIES: TaskPriority[] = ["High", "Medium", "Low"];
const DUE_FILTERS = [
  "Any due date",
  "Overdue",
  "Due today",
  "Upcoming",
  "No due date",
] as const;
type DueFilter = (typeof DUE_FILTERS)[number];

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const normalized = value.trim().replace(" ", "T");
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(normalized) ? `${normalized}T00:00:00` : normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value?: string | null) {
  const date = parseDate(value);
  return date
    ? date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Not set";
}

function formatDateTime(value?: string | null) {
  const date = parseDate(value);
  return date
    ? date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Not set";
}

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View
      style={[
        {
          borderRadius: 18,
          borderWidth: 1,
          borderColor: "#E5E9EF",
          backgroundColor: Colors.white,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function ChoiceChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: 34,
        justifyContent: "center",
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: selected ? "#EEE8F6" : "#F3F5F7",
      }}
    >
      <Text
        style={{
          color: selected ? "#5B2D87" : "#697586",
          fontSize: 12,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function TaskCard({
  task,
  grid,
  onEdit,
  onDelete,
  onToggleComplete,
}: {
  task: TodoTask;
  grid: boolean;
  onEdit: (task: TodoTask) => void;
  onDelete: (task: TodoTask) => void;
  onToggleComplete: (task: TodoTask) => void;
}) {
  const complete = task.status === "Completed";
  const priorityColor =
    task.priority === "High"
      ? { background: "#FFF0F0", text: "#B84242", border: "#F3D4D4" }
      : task.priority === "Low"
        ? { background: "#EAF6EF", text: "#32734A", border: "#D3EBDD" }
        : { background: "#FFF6E8", text: "#98640D", border: "#F2E3C4" };
  const statusColor =
    task.status === "Completed"
      ? { background: "#EAF6EF", text: "#32734A" }
      : task.status === "In Progress"
        ? { background: "#EAF4FC", text: "#316D9A" }
        : { background: "#F0F2F5", text: "#687386" };

  return (
    <Card
      style={{
        flex: grid ? 1 : undefined,
        width: grid ? undefined : "100%",
        minWidth: 0,
        minHeight: grid ? 248 : undefined,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          height: 4,
          backgroundColor: complete
            ? "#53A976"
            : task.priority === "High"
              ? "#D95B5B"
              : task.priority === "Low"
                ? "#53A976"
                : "#D5A23D",
        }}
      />
      <View
        style={{
          flex: grid ? 1 : undefined,
          justifyContent: grid ? "space-between" : undefined,
          padding: grid ? 15 : 12,
        }}
      >
        {!grid ? (
          <View style={{ gap: 9 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel={complete ? `Reopen ${task.title}` : `Complete ${task.title}`}
                accessibilityState={{ checked: complete }}
                onPress={() => onToggleComplete(task)}
                hitSlop={5}
              >
                <Ionicons
                  name={complete ? "checkmark-circle" : "ellipse-outline"}
                  size={23}
                  color={complete ? "#378B57" : "#AEB6C1"}
                />
              </Pressable>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    color: complete ? "#8B95A3" : "#253044",
                    fontSize: 15,
                    fontWeight: "800",
                    textDecorationLine: complete ? "line-through" : "none",
                  }}
                >
                  {task.title}
                </Text>
                <Text numberOfLines={2} style={{ marginTop: 3, color: task.description ? "#697586" : "#9AA3AF", fontSize: 11, lineHeight: 15 }}>
                  {task.description || "No notes added"}
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 1 }}>
                <IconButton
                  label={`Edit ${task.title}`}
                  icon="create-outline"
                  onPress={() => onEdit(task)}
                  color="#707C8D"
                />
                <IconButton
                  label={`Delete ${task.title}`}
                  icon="trash-outline"
                  onPress={() => onDelete(task)}
                  color="#BA6262"
                />
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, paddingLeft: 32 }}>
              <Tag
                label={task.priority}
                background={priorityColor.background}
                color={priorityColor.text}
                border={priorityColor.border}
              />
              <Tag
                label={task.status}
                background={statusColor.background}
                color={statusColor.text}
              />
              <DateInfo
                icon="calendar-outline"
                text={task.dueDate ? `Due ${formatDate(task.dueDate)}` : "No due date"}
              />
              <DateInfo
                icon="alarm-outline"
                text={task.reminderAt ? `Reminder ${formatDateTime(task.reminderAt)}` : "No reminder"}
              />
              <Text style={{ color: "#9AA3AF", fontSize: 10 }}>
                Created {formatDate(task.createdAt)}
              </Text>
              <Text style={{ color: "#9AA3AF", fontSize: 10 }}>
                Updated {formatDate(task.updatedAt)}
              </Text>
            </View>
          </View>
        ) : (
          <>
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            <Tag
              label={`${task.priority} priority`}
              background={priorityColor.background}
              color={priorityColor.text}
              border={priorityColor.border}
            />
            <Tag
              label={task.status}
              background={statusColor.background}
              color={statusColor.text}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 2 }}>
            <IconButton
              label={`Edit ${task.title}`}
              icon="create-outline"
              onPress={() => onEdit(task)}
              color="#707C8D"
            />
            <IconButton
              label={`Delete ${task.title}`}
              icon="trash-outline"
              onPress={() => onDelete(task)}
              color="#BA6262"
            />
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 13 }}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={complete ? `Reopen ${task.title}` : `Complete ${task.title}`}
            accessibilityState={{ checked: complete }}
            onPress={() => onToggleComplete(task)}
            hitSlop={5}
            style={{ paddingTop: 1 }}
          >
            <Ionicons
              name={complete ? "checkmark-circle" : "ellipse-outline"}
              size={23}
              color={complete ? "#378B57" : "#AEB6C1"}
            />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                color: complete ? "#8B95A3" : "#253044",
                fontSize: 16,
                lineHeight: 22,
                fontWeight: "800",
                textDecorationLine: complete ? "line-through" : "none",
              }}
            >
              {task.title}
            </Text>
            <Text
              style={{
                marginTop: 5,
                color: task.description ? "#697586" : "#9AA3AF",
                fontSize: 13,
                lineHeight: 19,
                fontStyle: task.description ? "normal" : "italic",
              }}
            >
              {task.description || "No notes added"}
            </Text>
          </View>
        </View>

        <View
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: "#EEF0F3",
            gap: 8,
          }}
        >
          <DateInfo
            icon="calendar-outline"
            text={task.dueDate ? `Due ${formatDate(task.dueDate)}` : "No due date"}
          />
          {task.reminderAt ? (
            <DateInfo
              icon="alarm-outline"
              text={`Reminder ${formatDateTime(task.reminderAt)}`}
            />
          ) : null}
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <Text style={{ color: "#9AA3AF", fontSize: 10 }}>
              Created {formatDate(task.createdAt)}
            </Text>
            <Text style={{ color: "#9AA3AF", fontSize: 10 }}>
              Updated {formatDate(task.updatedAt)}
            </Text>
          </View>
        </View>
          </>
        )}
      </View>
    </Card>
  );
}

function Tag({
  label,
  background,
  color,
  border,
}: {
  label: string;
  background: string;
  color: string;
  border?: string;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: background,
        borderWidth: border ? 1 : 0,
        borderColor: border,
      }}
    >
      <Text style={{ color, fontSize: 10, fontWeight: "800" }}>{label}</Text>
    </View>
  );
}

function IconButton({
  label,
  icon,
  color,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={5}
      style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 10 }}
    >
      <Ionicons name={icon} size={18} color={color} />
    </Pressable>
  );
}

function DateInfo({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
      <Ionicons name={icon} size={14} color="#8055A6" />
      <Text style={{ flex: 1, color: "#697586", fontSize: 11 }}>{text}</Text>
    </View>
  );
}

export default function TodosPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | TaskStatus>("All");
  const [priorityFilter, setPriorityFilter] = useState<"Any priority" | TaskPriority>("Any priority");
  const [dueDateFilter, setDueDateFilter] = useState<DueFilter>("Any due date");
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [draftStatusFilter, setDraftStatusFilter] = useState<"All" | TaskStatus>("All");
  const [draftPriorityFilter, setDraftPriorityFilter] = useState<"Any priority" | TaskPriority>("Any priority");
  const [draftDueDateFilter, setDraftDueDateFilter] = useState<DueFilter>("Any due date");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [errorMessage, setErrorMessage] = useState("");
  const [message, setMessage] = useState("");
  const [taskToDelete, setTaskToDelete] = useState<TodoTask | null>(null);
  const today = dateKey(new Date());

  const loadTasks = useCallback(async () => {
    try {
      const response = await api.get("/todos");
      const result = response.data?.data;
      if (!Array.isArray(result)) {
        throw new Error("The server returned an invalid task list.");
      }
      setTasks(result);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Unable to load your tasks."));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadTasks();
    }, [loadTasks]),
  );

  const completedCount = tasks.filter((task) => task.status === "Completed").length;
  const pendingCount = tasks.filter((task) => task.status === "Pending").length;
  const inProgressCount = tasks.filter((task) => task.status === "In Progress").length;

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesSearch =
        !query ||
        `${task.title || ""} ${task.description || ""}`.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "All" || task.status === statusFilter;
      const matchesPriority =
        priorityFilter === "Any priority" || task.priority === priorityFilter;
      const dueDate = task.dueDate?.slice(0, 10) || "";
      const matchesDueDate =
        dueDateFilter === "Any due date" ||
        (dueDateFilter === "Overdue" && !!dueDate && dueDate < today && task.status !== "Completed") ||
        (dueDateFilter === "Due today" && dueDate === today) ||
        (dueDateFilter === "Upcoming" && !!dueDate && dueDate > today) ||
        (dueDateFilter === "No due date" && !dueDate);
      return matchesSearch && matchesStatus && matchesPriority && matchesDueDate;
    });
  }, [dueDateFilter, priorityFilter, search, statusFilter, tasks, today]);

  const orderedTasks = useMemo(
    () => [
      ...filteredTasks.filter((task) => task.status !== "Completed"),
      ...filteredTasks.filter((task) => task.status === "Completed"),
    ],
    [filteredTasks],
  );
  const activeFilterCount = Number(statusFilter !== "All")
    + Number(priorityFilter !== "Any priority")
    + Number(dueDateFilter !== "Any due date");

  const openNewTaskForm = () => {
    router.push("/todo-form");
  };

  const openFilterSheet = () => {
    setDraftStatusFilter(statusFilter);
    setDraftPriorityFilter(priorityFilter);
    setDraftDueDateFilter(dueDateFilter);
    setFilterSheetVisible(true);
  };

  const applyFilters = () => {
    setStatusFilter(draftStatusFilter);
    setPriorityFilter(draftPriorityFilter);
    setDueDateFilter(draftDueDateFilter);
    setFilterSheetVisible(false);
  };

  const clearFilters = () => {
    setDraftStatusFilter("All");
    setDraftPriorityFilter("Any priority");
    setDraftDueDateFilter("Any due date");
  };

  const openEditTaskForm = (task: TodoTask) => {
    router.push({
      pathname: "/todo-form",
      params: {
        id: String(task.id),
        title: task.title || "",
        description: task.description || "",
        priority: task.priority || "Medium",
        status: task.status || "Pending",
        dueDate: task.dueDate?.slice(0, 10) || "",
        dueTime: task.dueDate?.slice(11, 16) || "",
        reminderAt: task.reminderAt
          ? task.reminderAt.replace(" ", "T").slice(0, 16)
          : "",
      },
    });
  };

  const changeTaskStatus = async (task: TodoTask) => {
    const status: TaskStatus = task.status === "Completed" ? "Pending" : "Completed";
    setErrorMessage("");
    try {
      const response = await api.put(`/todos/${task.id}`, { ...task, status });
      const updated = response.data?.data as TodoTask | undefined;
      if (!updated || updated.id === undefined) {
        throw new Error("The server did not return the updated task.");
      }
      setTasks((current) =>
        current.map((item) => (String(item.id) === String(task.id) ? updated : item)),
      );
      setMessage(status === "Completed" ? "Task completed." : "Task marked as pending.");
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Unable to update task status."));
    }
  };

  const deleteTask = async () => {
    if (!taskToDelete) return;
    const deleting = taskToDelete;
    setErrorMessage("");
    try {
      const response = await api.delete(`/todos/${deleting.id}`);
      setTasks((current) => current.filter((task) => String(task.id) !== String(deleting.id)));
      setTaskToDelete(null);
      setMessage(response.data?.message || "Task deleted.");
    } catch (error) {
      setTaskToDelete(null);
      setErrorMessage(getApiErrorMessage(error, "Unable to delete this task."));
    }
  };

  const statCards = [
    { label: "Total tasks", shortLabel: "All", value: tasks.length, color: "#FFFFFF" },
    { label: "Completed", shortLabel: "Done", value: completedCount, color: "#D5F4D3" },
    { label: "Pending", shortLabel: "Wait", value: pendingCount, color: "#E7F0B0" },
    { label: "In progress", shortLabel: "Prog", value: inProgressCount, color: "#FFE3A1" },
  ];
  const cardMode = viewMode === "grid";
  const isGrid = cardMode && width >= 640;
  const taskRows = isGrid
    ? orderedTasks.reduce<TodoTask[][]>((rows, task, index) => {
        if (index % 2 === 0) rows.push([task]);
        else rows[rows.length - 1].push(task);
        return rows;
      }, [])
    : orderedTasks.map((task) => [task]);

  return (
    <View style={{ flex: 1, backgroundColor: "#F2F5EA" }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          width: "100%",
          maxWidth: 1100,
          alignSelf: "center",
          paddingHorizontal: width >= 700 ? 28 : 16,
          paddingBottom: Math.max(insets.bottom, 16) + 100,
        }}
      >
        <AddPageHeader
          title="To Do List & Notes"
          onBack={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/tabs/more");
          }}
          horizontalInset={width >= 700 ? 28 : 16}
          rightContent={
            <View
              accessibilityLabel="Task summary"
              style={{
                width: 108,
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "flex-end",
                gap: 3,
              }}
            >
              {statCards.map((item) => (
                <View
                  key={item.label}
                  accessibilityLabel={`${item.label}: ${item.value}`}
                  style={{
                    minWidth: 51,
                    minHeight: 20,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 3,
                    paddingHorizontal: 4,
                    borderRadius: 7,
                    backgroundColor: "rgba(255,255,255,0.16)",
                  }}
                >
                  <Text style={{ color: item.color, fontSize: 10, fontWeight: "900" }}>
                    {item.value}
                  </Text>
                  <Text style={{ color: "rgba(255,255,255,0.88)", fontSize: 8, fontWeight: "700" }}>
                    {item.shortLabel}
                  </Text>
                </View>
              ))}
            </View>
          }
        />

        <View
          style={{
            minHeight: 50,
            flexDirection: "row",
            alignItems: "center",
            gap: 9,
            marginTop: 18,
            paddingLeft: 13,
            paddingRight: 5,
            borderRadius: 26,
            borderWidth: 1,
            borderColor: "#E2E7E3",
            backgroundColor: "white",
            shadowColor: "#253044",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 5,
            elevation: 2,
          }}
        >
            <Ionicons name="search-outline" size={18} color="#9AA3A0" />
            <TextInput
              accessibilityLabel="Search tasks"
              value={search}
              onChangeText={setSearch}
              placeholder="Search tasks..."
              placeholderTextColor="#9AA3AF"
              returnKeyType="search"
              style={{
                minHeight: 46,
                flex: 1,
                paddingVertical: 0,
                color: "#253044",
                fontSize: 13,
              }}
            />
            {search ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => setSearch("")}
                hitSlop={8}
                style={{ width: 32, height: 40, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="close-circle" size={18} color="#9AA3AF" />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                activeFilterCount
                  ? `Open filters, ${activeFilterCount} active`
                  : "Open filters"
              }
              accessibilityState={{ expanded: filterSheetVisible }}
              onPress={openFilterSheet}
              style={{
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 20,
              }}
            >
              <Ionicons
                name="options-outline"
                size={19}
                color={activeFilterCount ? "#5B2D87" : "#76817E"}
              />
              {activeFilterCount > 0 ? (
                <View
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: "#7B3FB0",
                  }}
                />
              ) : null}
            </Pressable>
        </View>

        {errorMessage ? (
          <View style={noticeStyle}>
            <Text style={noticeText}>{errorMessage}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setLoading(true);
                void loadTasks();
              }}
              hitSlop={8}
            >
              <Text style={{ color: "#5B2D87", fontSize: 12, fontWeight: "800" }}>Retry</Text>
            </Pressable>
          </View>
        ) : null}
        {message ? (
          <Pressable onPress={() => setMessage("")} style={[noticeStyle, { backgroundColor: "#EAF6EF", borderColor: "#D3EBDD" }]}>
            <Text style={{ flex: 1, color: "#32734A", fontSize: 12, fontWeight: "700" }}>{message}</Text>
            <Ionicons name="close" size={16} color="#32734A" />
          </Pressable>
        ) : null}

        {loading ? (
          <View style={{ paddingVertical: 48, alignItems: "center", gap: 10 }}>
            <ActivityIndicator color="#6D3DA0" />
            <Text style={{ color: "#687386", fontSize: 13 }}>Loading your tasks...</Text>
          </View>
        ) : tasks.length === 0 ? (
          <Card style={{ alignItems: "center", marginTop: 18, paddingHorizontal: 20, paddingVertical: 34 }}>
            <View style={{ width: 58, height: 58, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: "#F1EBF8" }}>
              <Ionicons name="list-outline" size={29} color="#6D3DA0" />
            </View>
            <Text style={{ marginTop: 14, color: "#253044", fontSize: 17, fontWeight: "900" }}>Your list is clear</Text>
            <Text style={{ marginTop: 5, color: "#687386", fontSize: 13, textAlign: "center" }}>
              Add your first task to get started.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={openNewTaskForm}
              style={{ marginTop: 16, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 15, paddingVertical: 11, borderRadius: 12, backgroundColor: "#5B2D87" }}
            >
              <Ionicons name="add" size={18} color="white" />
              <Text style={{ color: "white", fontSize: 13, fontWeight: "800" }}>Add a task</Text>
            </Pressable>
          </Card>
        ) : filteredTasks.length === 0 ? (
          <Card style={{ alignItems: "center", marginTop: 18, padding: 28 }}>
            <Ionicons name="filter-outline" size={28} color="#8993A1" />
            <Text style={{ marginTop: 8, color: "#687386", fontSize: 13, textAlign: "center" }}>
              No tasks match these search and filter options.
            </Text>
          </Card>
        ) : (
          <View
            style={{
              gap: 10,
              marginTop: 18,
            }}
          >
            {taskRows.map((row) => (
              <View
                key={row[0].id}
                style={{
                  flexDirection: isGrid ? "row" : "column",
                  alignItems: "stretch",
                  gap: 10,
                }}
              >
                {row.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    grid={cardMode}
                    onEdit={openEditTaskForm}
                    onDelete={setTaskToDelete}
                    onToggleComplete={(selected) => void changeTaskStatus(selected)}
                  />
                ))}
                {isGrid && row.length === 1 ? <View style={{ flex: 1 }} /> : null}
              </View>
            ))}
          </View>
        )}

      </ScrollView>

      <AddButton
      onPress={openNewTaskForm}
      accessibilityLabel="Create a Pulse"
      accessibilityHint="Opens the new task form"
      bottomOffset={20}
      />

      <Modal
        visible={filterSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterSheetVisible(false)}
        statusBarTranslucent
      >
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close filters"
            onPress={() => setFilterSheetVisible(false)}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: "rgba(12,16,25,0.5)",
            }}
          />
          <View
            style={{
              width: "100%",
              maxHeight: "82%",
              paddingBottom: Math.max(insets.bottom, 16),
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              backgroundColor: "white",
            }}
          >
            <View style={{ alignItems: "center", paddingTop: 10 }}>
              <View
                style={{
                  width: 38,
                  height: 4,
                  borderRadius: 3,
                  backgroundColor: "#D7DBE2",
                }}
              />
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 20,
                paddingTop: 17,
                paddingBottom: 13,
                borderBottomWidth: 1,
                borderBottomColor: "#EEF0F3",
              }}
            >
              <View>
                <Text style={{ color: "#253044", fontSize: 18, fontWeight: "900" }}>
                  Filter tasks
                </Text>
                <Text style={{ marginTop: 3, color: "#8791A0", fontSize: 12 }}>
                  Filter tasks or choose how they are displayed.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close filters"
                onPress={() => setFilterSheetVisible(false)}
                hitSlop={8}
                style={{
                  width: 36,
                  height: 36,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 12,
                  backgroundColor: "#F3F5F7",
                }}
              >
                <Ionicons name="close" size={20} color="#687386" />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 16 }}
            >
              <Text style={filterLabel}>Status</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {(["All", ...STATUSES] as const).map((status) => (
                  <ChoiceChip
                    key={status}
                    label={status}
                    selected={draftStatusFilter === status}
                    onPress={() => setDraftStatusFilter(status)}
                  />
                ))}
              </View>

              <Text style={filterLabel}>Priority</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {(["Any priority", ...PRIORITIES] as const).map((priority) => (
                  <ChoiceChip
                    key={priority}
                    label={priority === "Any priority" ? "All priorities" : priority}
                    selected={draftPriorityFilter === priority}
                    onPress={() => setDraftPriorityFilter(priority)}
                  />
                ))}
              </View>

              <Text style={filterLabel}>Due date</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {DUE_FILTERS.map((due) => (
                  <ChoiceChip
                    key={due}
                    label={due}
                    selected={draftDueDateFilter === due}
                    onPress={() => setDraftDueDateFilter(due)}
                  />
                ))}
              </View>

              <Text style={filterLabel}>View mode</Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {([
                  { mode: "list", label: "List view", icon: "list-outline" },
                  { mode: "grid", label: "Card view", icon: "grid-outline" },
                ] as const).map((option) => {
                  const selected = viewMode === option.mode;
                  return (
                    <Pressable
                      key={option.mode}
                      accessibilityRole="radio"
                      accessibilityLabel={option.label}
                      accessibilityState={{ selected }}
                      onPress={() => {
                        setViewMode(option.mode);
                        setFilterSheetVisible(false);
                      }}
                      style={{
                        minHeight: 48,
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        borderRadius: 13,
                        borderWidth: 1,
                        borderColor: selected ? "#7B55A0" : "#E1E5EA",
                        backgroundColor: selected ? "#F3EEF8" : "white",
                      }}
                    >
                      <Ionicons
                        name={option.icon}
                        size={18}
                        color={selected ? "#5B2D87" : "#7D8795"}
                      />
                      <Text
                        style={{
                          color: selected ? "#5B2D87" : "#687386",
                          fontSize: 12,
                          fontWeight: "800",
                        }}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <View
              style={{
                flexDirection: "row",
                gap: 10,
                paddingHorizontal: 20,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: "#EEF0F3",
              }}
            >
              <Pressable
                accessibilityRole="button"
                onPress={clearFilters}
                style={{
                  minHeight: 48,
                  minWidth: 100,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 16,
                  borderRadius: 13,
                  borderWidth: 1,
                  borderColor: "#DDE2E8",
                }}
              >
                <Text style={{ color: "#687386", fontSize: 13, fontWeight: "800" }}>
                  Reset
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={applyFilters}
                style={{
                  minHeight: 48,
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 16,
                  borderRadius: 13,
                  backgroundColor: "#5B2D87",
                }}
              >
                <Text style={{ color: "white", fontSize: 13, fontWeight: "900" }}>
                  Apply filters
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmPopup
        visible={Boolean(taskToDelete)}
        type="delete"
        title="Delete task?"
        message={
          taskToDelete
            ? `Delete "${taskToDelete.title}"? This action cannot be undone.`
            : ""
        }
        confirmText="Delete"
        onConfirm={deleteTask}
        onCancel={() => setTaskToDelete(null)}
      />
    </View>
  );
}

const filterLabel = {
  marginTop: 10,
  marginBottom: 7,
  color: "#8791A0",
  fontSize: 10,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 0.7,
};

const noticeStyle = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
  gap: 10,
  marginTop: 12,
  paddingHorizontal: 12,
  paddingVertical: 11,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: "#F1D3D3",
  backgroundColor: "#FFF1F1",
};

const noticeText = {
  flex: 1,
  color: "#A13F3F",
  fontSize: 12,
  lineHeight: 17,
  fontWeight: "600" as const,
};
