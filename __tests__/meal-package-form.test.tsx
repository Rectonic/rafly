import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { ScrollView } from "react-native";

import { MealPackageForm } from "@/components/seller/MealPackageForm";

jest.mock("@/lib/locale-store", () => ({
  useLocale: () => "en",
}));

describe("MealPackageForm", () => {
  it("does not create a nested vertical scroll view", () => {
    const screen = render(
      <MealPackageForm isSubmitting={false} onSubmit={jest.fn()} />
    );

    const scrollViews = screen.UNSAFE_getAllByType(ScrollView);

    expect(scrollViews).toHaveLength(1);
    expect(scrollViews[0].props.horizontal).toBe(true);
  });

  it("submits multilingual buyer-facing title and contents fields", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const screen = render(
      <MealPackageForm isSubmitting={false} onSubmit={onSubmit} />
    );

    fireEvent.changeText(
      screen.getByTestId("meal-form-title-input"),
      "Closing pasta bundle"
    );
    fireEvent.changeText(
      screen.getByTestId("meal-form-title-ru-input"),
      "Вечерний набор пасты"
    );
    fireEvent.changeText(
      screen.getByTestId("meal-form-contents-input"),
      "Pasta tray\nGarlic bread"
    );
    fireEvent.changeText(
      screen.getByTestId("meal-form-contents-ru-input"),
      "Паста\nЧесночный хлеб"
    );

    fireEvent.press(screen.getByTestId("meal-form-submit-button"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        translations: {
          ru: {
            contentsText: "Паста\nЧесночный хлеб",
            title: "Вечерний набор пасты",
          },
        },
      })
    );
  });

  it("submits product page pickup, allergen, dietary, and policy details", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const screen = render(
      <MealPackageForm isSubmitting={false} onSubmit={onSubmit} />
    );

    fireEvent.changeText(
      screen.getByTestId("meal-form-pickup-instructions-input"),
      "Use the side entrance."
    );
    fireEvent.changeText(
      screen.getByTestId("meal-form-dietary-badges-input"),
      "Vegetarian\nHalal"
    );
    fireEvent.changeText(
      screen.getByTestId("meal-form-allergens-input"),
      "Contains gluten\nContains dairy"
    );
    fireEvent.changeText(
      screen.getByTestId("meal-form-cancellation-policy-input"),
      "Cancel 30 minutes before pickup for a refund."
    );

    fireEvent.press(screen.getByTestId("meal-form-submit-button"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        allergensText: "Contains gluten\nContains dairy",
        cancellationPolicy: "Cancel 30 minutes before pickup for a refund.",
        dietaryBadgesText: "Vegetarian\nHalal",
        pickupInstructions: "Use the side entrance.",
      })
    );
  });
});
