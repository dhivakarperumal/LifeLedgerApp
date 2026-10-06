import type { ReactNode } from "react";
import {
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
    type PressableProps,
    type StyleProp,
    type TextInputProps,
    type TextStyle,
    type ViewStyle,
} from "react-native";
import { Colors } from "../constants/colors";
import { toTitleCase } from "./formLabelUtils";

type FormInputProps = Omit<TextInputProps, "placeholderTextColor" | "style"> & {
  bordered?: boolean;
  borderColor?: TextStyle["borderColor"];
  className?: string;
  style?: StyleProp<TextStyle>;
};

export function FormInput({
  bordered = true,
  borderColor,
  className,
  style,
  ...props
}: FormInputProps) {
  return (
    <TextInput
      {...props}
      placeholderTextColor={Colors.textSecondary}
      className={className}
      style={[
        style,
        bordered && styles.inputBorder,
        bordered && borderColor && { borderColor },
      ]}
    />
  );
}

type FormFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: TextInputProps["keyboardType"];
  borderColor?: TextStyle["borderColor"];
  labelColor?: TextStyle["color"];
};

export function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType,
  borderColor,
  labelColor,
}: FormFieldProps) {
  return (
    <View style={styles.formFieldContainer}>
      <Text
        style={[
          formFieldStyles.label,
          labelColor ? { color: labelColor } : undefined,
        ]}
      >
        {toTitleCase(label)}
      </Text>
      <FormInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        borderColor={borderColor}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        textAlignVertical={multiline ? "top" : "center"}
        style={[
          formFieldStyles.input,
          multiline && styles.multilineFormFieldInput,
        ]}
      />
    </View>
  );
}

export const formFieldStyles = StyleSheet.create({
  label: {
    marginBottom: 7,
    color: "#4B5563",
    fontSize: 12,
    fontWeight: "700",
  },
  input: {
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#F8FAF8",
    color: Colors.textPrimary,
    fontSize: 15,
  },
});

type FormOptionProps = Omit<PressableProps, "style"> & {
  children: ReactNode;
  className?: string;
  selected: boolean;
  style?: StyleProp<ViewStyle>;
};

export function FormOption({
  children,
  className,
  selected,
  style,
  ...props
}: FormOptionProps) {
  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={className}
      style={[
        style,
        styles.optionBorder,
        selected ? styles.optionSelected : styles.optionUnselected,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  formFieldContainer: {
    marginBottom: 13,
  },
  multilineFormFieldInput: {
    minHeight: 88,
  },
  inputBorder: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionBorder: {
    borderWidth: 1,
  },
  optionSelected: {
    borderColor: Colors.primary,
  },
  optionUnselected: {
    borderColor: Colors.border,
  },
});
