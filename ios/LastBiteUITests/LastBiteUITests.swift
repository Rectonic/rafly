import XCTest

final class LastBiteUITests: XCTestCase {
  override func setUpWithError() throws {
    continueAfterFailure = false
  }

  func testBuyerFeedOfferReservationFlow() throws {
    let app = XCUIApplication()
    app.launch()

    XCTAssertTrue(
      element(app, "feed-screen").waitForExistence(timeout: 30),
      debugHierarchy(app)
    )
    XCTAssertTrue(
      element(app, "feed-search-input").waitForExistence(timeout: 10),
      debugHierarchy(app)
    )

    let bakedGoodsFilter = element(app, "category-filter-Baked Goods")
    XCTAssertTrue(bakedGoodsFilter.waitForExistence(timeout: 10), debugHierarchy(app))
    tap(bakedGoodsFilter)

    let offerCard = element(app, "offer-card-9")
    XCTAssertTrue(offerCard.waitForExistence(timeout: 10), debugHierarchy(app))
    tap(offerCard)

    XCTAssertTrue(
      element(app, "offer-detail-screen").waitForExistence(timeout: 10),
      debugHierarchy(app)
    )

    let reserveButton = element(app, "offer-detail-reserve-button")
    XCTAssertTrue(reserveButton.waitForExistence(timeout: 10), debugHierarchy(app))
    tap(reserveButton)

    let pickupCode = app.staticTexts["reservation-pickup-code"]
    XCTAssertTrue(pickupCode.waitForExistence(timeout: 20), debugHierarchy(app))
    XCTAssertTrue(pickupCode.label.hasPrefix("LB-"), debugHierarchy(app))

    attachScreenshot(app, named: "Reservation confirmation")
  }

  func testBuyerOfferDetailCloseButtonFlow() throws {
    let app = XCUIApplication()
    app.launch()

    XCTAssertTrue(
      element(app, "feed-screen").waitForExistence(timeout: 30),
      debugHierarchy(app)
    )

    let bakedGoodsFilter = element(app, "category-filter-Baked Goods")
    XCTAssertTrue(bakedGoodsFilter.waitForExistence(timeout: 10), debugHierarchy(app))
    tap(bakedGoodsFilter)

    let offerCard = element(app, "offer-card-9")
    XCTAssertTrue(offerCard.waitForExistence(timeout: 10), debugHierarchy(app))
    tap(offerCard)

    XCTAssertTrue(
      element(app, "offer-detail-screen").waitForExistence(timeout: 10),
      debugHierarchy(app)
    )

    let closeButton = element(app, "offer-detail-close-button")
    XCTAssertTrue(closeButton.waitForExistence(timeout: 10), debugHierarchy(app))
    XCTAssertTrue(
      element(app, "offer-detail-contents-section").waitForExistence(timeout: 10),
      debugHierarchy(app)
    )
    XCTAssertTrue(
      element(app, "offer-detail-pickup-instructions-section").waitForExistence(timeout: 10),
      debugHierarchy(app)
    )
    XCTAssertTrue(
      element(app, "offer-detail-dietary-section").waitForExistence(timeout: 10),
      debugHierarchy(app)
    )
    XCTAssertTrue(
      element(app, "offer-detail-allergens-section").waitForExistence(timeout: 10),
      debugHierarchy(app)
    )
    XCTAssertTrue(
      element(app, "offer-detail-cancellation-policy-section").waitForExistence(timeout: 10),
      debugHierarchy(app)
    )
    attachScreenshot(app, named: "Offer detail product info")
    tap(closeButton)

    XCTAssertTrue(
      element(app, "feed-screen").waitForExistence(timeout: 10),
      debugHierarchy(app)
    )
  }

  func testBuyerMapLocationTapSelectsVisibleOffer() throws {
    let app = XCUIApplication()
    app.launch()

    XCTAssertTrue(
      element(app, "feed-screen").waitForExistence(timeout: 30),
      debugHierarchy(app)
    )

    let mapFrame = element(app, "offers-map-frame")
    XCTAssertTrue(mapFrame.waitForExistence(timeout: 10), debugHierarchy(app))
    attachScreenshot(app, named: "Buyer map aligned before location tap")

    mapFrame.coordinate(withNormalizedOffset: CGVector(dx: 0.44, dy: 0.31)).tap()

    let selectedOfferCard = element(app, "offer-card-4")
    XCTAssertTrue(selectedOfferCard.waitForExistence(timeout: 5), debugHierarchy(app))
    XCTAssertTrue(selectedOfferCard.isSelected, debugHierarchy(app))
    attachScreenshot(app, named: "Buyer map selected offer after location tap")
  }

  func testBuyerDiscoveryRadiusControlsFilterVisibleOffers() throws {
    let app = XCUIApplication()
    app.launch()

    XCTAssertTrue(
      element(app, "feed-screen").waitForExistence(timeout: 30),
      debugHierarchy(app)
    )

    XCTAssertTrue(
      element(app, "near-me-button").waitForExistence(timeout: 10),
      debugHierarchy(app)
    )

    let oneKmRadius = element(app, "radius-filter-1")
    XCTAssertTrue(oneKmRadius.waitForExistence(timeout: 10), debugHierarchy(app))
    tap(oneKmRadius)

    XCTAssertTrue(
      element(app, "offer-card-1").waitForExistence(timeout: 10),
      debugHierarchy(app)
    )
    XCTAssertTrue(
      element(app, "offer-card-8").waitForExistence(timeout: 10),
      debugHierarchy(app)
    )
    XCTAssertFalse(
      element(app, "offer-card-9").waitForExistence(timeout: 2),
      debugHierarchy(app)
    )
    attachScreenshot(app, named: "Buyer radius filtered discovery")
  }

  func testBuyerReservationHistoryRecoveryFlow() throws {
    let app = XCUIApplication()
    app.launch()

    XCTAssertTrue(
      element(app, "feed-screen").waitForExistence(timeout: 30),
      debugHierarchy(app)
    )

    let bakedGoodsFilter = element(app, "category-filter-Baked Goods")
    XCTAssertTrue(bakedGoodsFilter.waitForExistence(timeout: 10), debugHierarchy(app))
    tap(bakedGoodsFilter)

    let offerCard = element(app, "offer-card-4")
    XCTAssertTrue(offerCard.waitForExistence(timeout: 10), debugHierarchy(app))
    tap(offerCard)

    XCTAssertTrue(
      element(app, "offer-detail-screen").waitForExistence(timeout: 10),
      debugHierarchy(app)
    )

    let reserveButton = element(app, "offer-detail-reserve-button")
    XCTAssertTrue(reserveButton.waitForExistence(timeout: 10), debugHierarchy(app))
    tap(reserveButton)

    let pickupCode = app.staticTexts["reservation-pickup-code"]
    XCTAssertTrue(pickupCode.waitForExistence(timeout: 20), debugHierarchy(app))
    XCTAssertTrue(pickupCode.label.hasPrefix("LB-"), debugHierarchy(app))

    let closeButton = element(app, "offer-detail-close-button")
    XCTAssertTrue(closeButton.waitForExistence(timeout: 10), debugHierarchy(app))
    tap(closeButton)

    XCTAssertTrue(
      element(app, "feed-screen").waitForExistence(timeout: 10),
      debugHierarchy(app)
    )

    let reservationsTab = button(app, "tab-reservations")
    XCTAssertTrue(reservationsTab.waitForExistence(timeout: 10), debugHierarchy(app))
    tap(reservationsTab)

    XCTAssertTrue(
      element(app, "reservations-screen").waitForExistence(timeout: 10),
      debugHierarchy(app)
    )

    let recoveredPickupCode = app.staticTexts.matching(
      NSPredicate(format: "label BEGINSWITH %@", "LB-")
    ).firstMatch
    XCTAssertTrue(recoveredPickupCode.waitForExistence(timeout: 10), debugHierarchy(app))
    attachScreenshot(app, named: "Buyer reservation history")
  }

  func testBuyerPickupReminderStatusFlow() throws {
    let app = XCUIApplication()
    app.launch()

    XCTAssertTrue(
      element(app, "feed-screen").waitForExistence(timeout: 30),
      debugHierarchy(app)
    )

    let mealsFilter = element(app, "category-filter-Meals")
    XCTAssertTrue(mealsFilter.waitForExistence(timeout: 10), debugHierarchy(app))
    tap(mealsFilter)

    let offerCard = element(app, "offer-card-5")
    XCTAssertTrue(offerCard.waitForExistence(timeout: 10), debugHierarchy(app))
    XCTAssertTrue(offerCard.isHittable, debugHierarchy(app))
    tap(offerCard)

    XCTAssertTrue(
      element(app, "offer-detail-screen").waitForExistence(timeout: 10),
      debugHierarchy(app)
    )

    let reserveButton = element(app, "offer-detail-reserve-button")
    XCTAssertTrue(reserveButton.waitForExistence(timeout: 10), debugHierarchy(app))
    tap(reserveButton)

    XCTAssertTrue(
      element(app, "reservation-confirmation-panel").waitForExistence(timeout: 20),
      debugHierarchy(app)
    )

    let viewReservationButton = element(app, "offer-detail-view-reservation-button")
    XCTAssertTrue(viewReservationButton.waitForExistence(timeout: 10), debugHierarchy(app))
    tap(viewReservationButton)

    XCTAssertTrue(
      element(app, "reservations-screen").waitForExistence(timeout: 10),
      debugHierarchy(app)
    )

    let reminderStatus = app.staticTexts.matching(
      NSPredicate(format: "label CONTAINS %@ OR label CONTAINS %@", "Reminder scheduled", "Напоминание")
    ).firstMatch
    XCTAssertTrue(reminderStatus.waitForExistence(timeout: 10), debugHierarchy(app))
    attachScreenshot(app, named: "Buyer pickup reminder scheduled")
  }

  func testBuyerSettingsSellerAuthEntryFlow() throws {
    let app = XCUIApplication()
    app.launch()

    XCTAssertTrue(
      element(app, "feed-screen").waitForExistence(timeout: 30),
      debugHierarchy(app)
    )

    let settingsTab = tabButton(app, identifier: "tab-settings", labels: ["Settings", "Настройки"])
    XCTAssertTrue(settingsTab.waitForExistence(timeout: 10), debugHierarchy(app))
    tap(settingsTab)

    XCTAssertTrue(
      element(app, "settings-screen").waitForExistence(timeout: 10),
      debugHierarchy(app)
    )
    XCTAssertTrue(
      element(app, "settings-language-en").waitForExistence(timeout: 10),
      debugHierarchy(app)
    )

    let sellerModeButton = element(app, "settings-seller-mode-button")
    XCTAssertTrue(sellerModeButton.waitForExistence(timeout: 10), debugHierarchy(app))
    tap(sellerModeButton)

    XCTAssertTrue(
      element(app, "seller-login-screen").waitForExistence(timeout: 10),
      debugHierarchy(app)
    )
    XCTAssertTrue(
      element(app, "seller-login-email-input").waitForExistence(timeout: 10),
      debugHierarchy(app)
    )
    XCTAssertTrue(
      element(app, "seller-login-password-input").waitForExistence(timeout: 10),
      debugHierarchy(app)
    )
    XCTAssertTrue(
      element(app, "seller-login-submit-button").waitForExistence(timeout: 10),
      debugHierarchy(app)
    )

    let signupLink = element(app, "seller-signup-link")
    XCTAssertTrue(signupLink.waitForExistence(timeout: 10), debugHierarchy(app))
    tap(signupLink)

    XCTAssertTrue(
      element(app, "seller-signup-screen").waitForExistence(timeout: 10),
      debugHierarchy(app)
    )
    XCTAssertTrue(
      element(app, "seller-signup-email-input").waitForExistence(timeout: 10),
      debugHierarchy(app)
    )
  }

  func testBuyerSettingsLanguageSwitchUpdatesVisibleCopy() throws {
    let app = XCUIApplication()
    app.launch()

    XCTAssertTrue(
      element(app, "feed-screen").waitForExistence(timeout: 30),
      debugHierarchy(app)
    )

    let settingsTab = tabButton(app, identifier: "tab-settings", labels: ["Settings", "Настройки"])
    XCTAssertTrue(settingsTab.waitForExistence(timeout: 10), debugHierarchy(app))
    tap(settingsTab)

    XCTAssertTrue(
      element(app, "settings-screen").waitForExistence(timeout: 10),
      debugHierarchy(app)
    )

    let englishButton = element(app, "settings-language-en")
    XCTAssertTrue(englishButton.waitForExistence(timeout: 10), debugHierarchy(app))
    tap(englishButton)
    XCTAssertTrue(app.staticTexts["Settings"].waitForExistence(timeout: 10), debugHierarchy(app))
    attachScreenshot(app, named: "Settings English")

    let russianButton = element(app, "settings-language-ru")
    XCTAssertTrue(russianButton.waitForExistence(timeout: 10), debugHierarchy(app))
    tap(russianButton)
    XCTAssertTrue(app.staticTexts["Настройки"].waitForExistence(timeout: 10), debugHierarchy(app))
    attachScreenshot(app, named: "Settings Russian")
  }

  func testBuyerFavoritesTabFlow() throws {
    let app = XCUIApplication()
    app.launch()

    XCTAssertTrue(
      element(app, "feed-screen").waitForExistence(timeout: 30),
      debugHierarchy(app)
    )

    let favoritesTab = button(app, "tab-favorites")
    XCTAssertTrue(favoritesTab.waitForExistence(timeout: 10), debugHierarchy(app))
    tap(favoritesTab)

    XCTAssertTrue(
      element(app, "favorites-screen").waitForExistence(timeout: 10),
      debugHierarchy(app)
    )

    let existingFavorite = element(app, "offer-card-9")
    if existingFavorite.waitForExistence(timeout: 2) {
      tap(element(app, "favorite-toggle-9"))
      XCTAssertFalse(
        element(app, "offer-card-9").waitForExistence(timeout: 5),
        debugHierarchy(app)
      )
    }

    let feedTab = button(app, "tab-feed")
    XCTAssertTrue(feedTab.waitForExistence(timeout: 10), debugHierarchy(app))
    tap(feedTab)

    XCTAssertTrue(
      element(app, "feed-screen").waitForExistence(timeout: 10),
      debugHierarchy(app)
    )

    let bakedGoodsFilter = element(app, "category-filter-Baked Goods")
    XCTAssertTrue(bakedGoodsFilter.waitForExistence(timeout: 10), debugHierarchy(app))
    tap(bakedGoodsFilter)

    let favoriteToggle = element(app, "favorite-toggle-9")
    XCTAssertTrue(favoriteToggle.waitForExistence(timeout: 10), debugHierarchy(app))
    tap(favoriteToggle)

    tap(favoritesTab)

    XCTAssertTrue(
      element(app, "favorites-screen").waitForExistence(timeout: 10),
      debugHierarchy(app)
    )
    XCTAssertTrue(
      element(app, "offer-card-9").waitForExistence(timeout: 10),
      debugHierarchy(app)
    )
    attachScreenshot(app, named: "Favorites with saved offer")

    tap(element(app, "favorite-toggle-9"))

    XCTAssertFalse(
      element(app, "offer-card-9").waitForExistence(timeout: 5),
      debugHierarchy(app)
    )
    attachScreenshot(app, named: "Favorites after unfavorite")
  }

  func testAuthenticatedSellerSurfaceFlow() throws {
    #if LOCAL_SELLER_E2E
      let app = XCUIApplication()
      app.launch()

      XCTAssertTrue(
        element(app, "feed-screen").waitForExistence(timeout: 30),
        debugHierarchy(app)
      )

      let settingsTab = tabButton(app, identifier: "tab-settings", labels: ["Settings", "Настройки"])
      XCTAssertTrue(settingsTab.waitForExistence(timeout: 10), debugHierarchy(app))
      tap(settingsTab)

      XCTAssertTrue(
        element(app, "settings-screen").waitForExistence(timeout: 10),
        debugHierarchy(app)
      )

      let sellerModeButton = element(app, "settings-seller-mode-button")
      XCTAssertTrue(sellerModeButton.waitForExistence(timeout: 10), debugHierarchy(app))
      tap(sellerModeButton)

      XCTAssertTrue(
        element(app, "seller-dashboard-screen").waitForExistence(timeout: 10),
        debugHierarchy(app)
      )
      XCTAssertTrue(
        element(app, "seller-setup-checklist").waitForExistence(timeout: 10),
        debugHierarchy(app)
      )
      XCTAssertTrue(
        element(app, "seller-setup-step-offer").waitForExistence(timeout: 10),
        debugHierarchy(app)
      )
      attachScreenshot(app, named: "Seller dashboard")

      let primaryAction = element(app, "seller-dashboard-primary-action")
      XCTAssertTrue(primaryAction.waitForExistence(timeout: 10), debugHierarchy(app))
      tap(primaryAction)

      XCTAssertTrue(
        element(app, "create-offer-screen").waitForExistence(timeout: 10),
        debugHierarchy(app)
      )
      XCTAssertTrue(
        element(app, "meal-form-title-input").waitForExistence(timeout: 10),
        debugHierarchy(app)
      )
      XCTAssertTrue(
        element(app, "meal-form-submit-button").waitForExistence(timeout: 10),
        debugHierarchy(app)
      )
      attachScreenshot(app, named: "Seller create offer")

      let ordersTab = tabButton(app, identifier: "seller-tab-orders", labels: ["Orders", "История"])
      XCTAssertTrue(ordersTab.waitForExistence(timeout: 10), debugHierarchy(app))
      tap(ordersTab)

      XCTAssertTrue(
        element(app, "seller-orders-screen").waitForExistence(timeout: 10),
        debugHierarchy(app)
      )
      XCTAssertTrue(
        element(app, "orders-manual-code-input").waitForExistence(timeout: 10),
        debugHierarchy(app)
      )
      XCTAssertTrue(
        element(app, "orders-segment-cancelled").waitForExistence(timeout: 10),
        debugHierarchy(app)
      )

      let scanButton = element(app, "orders-scan-code-button")
      XCTAssertTrue(scanButton.waitForExistence(timeout: 10), debugHierarchy(app))
      tap(scanButton)

      XCTAssertTrue(
        element(app, "scanner-modal").waitForExistence(timeout: 10),
        debugHierarchy(app)
      )
      attachScreenshot(app, named: "Seller scanner modal")

      let closeScannerButton = element(app, "scanner-close-button")
      XCTAssertTrue(closeScannerButton.waitForExistence(timeout: 10), debugHierarchy(app))
      tap(closeScannerButton)

      let profileTab = tabButton(app, identifier: "seller-tab-profile", labels: ["Profile", "Профиль"])
      XCTAssertTrue(profileTab.waitForExistence(timeout: 10), debugHierarchy(app))
      tap(profileTab)

      XCTAssertTrue(
        element(app, "seller-profile-screen").waitForExistence(timeout: 10),
        debugHierarchy(app)
      )
      XCTAssertTrue(
        element(app, "seller-profile-business-name-input").waitForExistence(timeout: 10),
        debugHierarchy(app)
      )
      let switchBuyerButton = element(app, "seller-profile-switch-buyer-button")
      scrollUntilHittable(switchBuyerButton, in: app)
      XCTAssertTrue(
        switchBuyerButton.waitForExistence(timeout: 10),
        debugHierarchy(app)
      )
      attachScreenshot(app, named: "Seller profile")

      tap(switchBuyerButton)

      XCTAssertTrue(
        element(app, "feed-screen").waitForExistence(timeout: 10),
        debugHierarchy(app)
      )
    #else
      throw XCTSkip(
        "Requires EXPO_PUBLIC_LASTBITE_E2E_LOCAL_SELLER=1 at bundle build time and LOCAL_SELLER_E2E for the UI test target."
      )
    #endif
  }

  func testAuthenticatedShopInventorySurfaceFlow() throws {
    #if LOCAL_SELLER_E2E
      let app = XCUIApplication()
      app.launch()

      XCTAssertTrue(
        element(app, "feed-screen").waitForExistence(timeout: 30),
        debugHierarchy(app)
      )

      let settingsTab = tabButton(app, identifier: "tab-settings", labels: ["Settings", "Настройки"])
      XCTAssertTrue(settingsTab.waitForExistence(timeout: 10), debugHierarchy(app))
      tap(settingsTab)

      XCTAssertTrue(
        element(app, "settings-screen").waitForExistence(timeout: 10),
        debugHierarchy(app)
      )

      let sellerModeButton = element(app, "settings-seller-mode-button")
      XCTAssertTrue(sellerModeButton.waitForExistence(timeout: 10), debugHierarchy(app))
      tap(sellerModeButton)

      XCTAssertTrue(
        element(app, "seller-dashboard-screen").waitForExistence(timeout: 10),
        debugHierarchy(app)
      )
      XCTAssertTrue(
        element(app, "seller-setup-checklist").waitForExistence(timeout: 10),
        debugHierarchy(app)
      )
      XCTAssertTrue(
        element(app, "seller-setup-step-inventory").waitForExistence(timeout: 10),
        debugHierarchy(app)
      )

      let inventoryTab = tabButton(app, identifier: "seller-tab-inventory", labels: ["Inventory", "Товары"])
      XCTAssertTrue(inventoryTab.waitForExistence(timeout: 10), debugHierarchy(app))
      tap(inventoryTab)

      XCTAssertTrue(
        element(app, "inventory-screen").waitForExistence(timeout: 10),
        debugHierarchy(app)
      )
      XCTAssertTrue(
        element(app, "inventory-product-name-input").waitForExistence(timeout: 10),
        debugHierarchy(app)
      )
      XCTAssertTrue(
        element(app, "inventory-barcode-input").waitForExistence(timeout: 10),
        debugHierarchy(app)
      )
      XCTAssertTrue(
        element(app, "inventory-expiry-date-input").waitForExistence(timeout: 10),
        debugHierarchy(app)
      )
      XCTAssertTrue(
        element(app, "inventory-quantity-input").waitForExistence(timeout: 10),
        debugHierarchy(app)
      )
      XCTAssertTrue(
        element(app, "inventory-add-item-button").waitForExistence(timeout: 10),
        debugHierarchy(app)
      )
      attachScreenshot(app, named: "Seller inventory")

      let scanBarcodeButton = element(app, "inventory-scan-barcode-button")
      XCTAssertTrue(scanBarcodeButton.waitForExistence(timeout: 10), debugHierarchy(app))
      tap(scanBarcodeButton)

      XCTAssertTrue(
        element(app, "scanner-modal").waitForExistence(timeout: 10),
        debugHierarchy(app)
      )
      attachScreenshot(app, named: "Seller inventory scanner modal")

      let closeScannerButton = element(app, "scanner-close-button")
      XCTAssertTrue(closeScannerButton.waitForExistence(timeout: 10), debugHierarchy(app))
      tap(closeScannerButton)

      XCTAssertTrue(
        element(app, "inventory-screen").waitForExistence(timeout: 10),
        debugHierarchy(app)
      )
    #else
      throw XCTSkip(
        "Requires EXPO_PUBLIC_LASTBITE_E2E_LOCAL_SELLER=1, EXPO_PUBLIC_LASTBITE_E2E_SELLER_TYPE=shop, and LOCAL_SELLER_E2E for the UI test target."
      )
    #endif
  }

  private func element(_ app: XCUIApplication, _ identifier: String) -> XCUIElement {
    app.descendants(matching: .any)[identifier]
  }

  private func button(_ app: XCUIApplication, _ identifier: String) -> XCUIElement {
    app.buttons[identifier]
  }

  private func tabButton(_ app: XCUIApplication, identifier: String, labels: [String]) -> XCUIElement {
    for label in labels {
      let labelButton = app.tabBars.buttons[label]
      if labelButton.exists {
        return labelButton
      }
    }

    let identifierButton = app.tabBars.buttons[identifier]
    if identifierButton.exists {
      return identifierButton
    }

    return element(app, identifier)
  }

  private func tap(_ element: XCUIElement) {
    if element.isHittable {
      element.tap()
    } else {
      element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }
  }

  private func scrollUntilHittable(
    _ element: XCUIElement,
    in app: XCUIApplication,
    maxSwipes: Int = 4
  ) {
    for _ in 0..<maxSwipes {
      if element.isHittable {
        return
      }

      app.swipeUp()
    }
  }

  private func attachScreenshot(_ app: XCUIApplication, named name: String) {
    let screenshot = XCTAttachment(screenshot: app.screenshot())
    screenshot.name = name
    screenshot.lifetime = .keepAlways
    add(screenshot)
  }

  private func debugHierarchy(_ app: XCUIApplication) -> String {
    String(app.debugDescription.prefix(8_000))
  }
}
