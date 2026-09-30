import type { ReactNode } from "react";
import {
    Pressable,
    StyleSheet,
    TextInput,
    type PressableProps,
    type StyleProp,
    type TextInputProps,
    type TextStyle,
    type ViewStyle,
} from "react-native";
import { Colors } from "../constants/colors";

type FormInputProps = Omit<TextInputProps, "placeholderTextColor" | "style"> & {
  bordered?: boolean;
  className?: string;
  style?: StyleProp<TextStyle>;
};

export function FormInput({
  bordered = true,
  className,
  style,
  ...props
}: FormInputProps) {
  return (
    <TextInput
      {...props}
      placeholderTextColor={Colors.textSecondary}
      className={className}
      style={[style, bordered && styles.inputBorder]}
    />
  );
}

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
