import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";

export type TabBarIconName = ComponentProps<typeof Ionicons>["name"];

type TabBarIconProps = {
  color: string;
  focused: boolean;
  focusedName?: TabBarIconName;
  name: TabBarIconName;
  size: number;
};

export function TabBarIcon({
  color,
  focused,
  focusedName,
  name,
  size,
}: TabBarIconProps) {
  return (
    <Ionicons
      color={color}
      name={focused ? focusedName ?? name : name}
      size={size}
    />
  );
}
