/**
 * Seller v2 strings for the Shop Seller beta: role aware navigation,
 * inventory confidence, count sessions, and offer publication. Demo and v1
 * Restaurant Seller screens keep using the existing top level seller
 * translation group, this namespace is additive and only rendered once a
 * screen has confirmed Shop Seller beta access through
 * useStoreMembershipV2.
 */
function pluralRu(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export interface SellerTranslations {
  access: {
    loading: string;
    unavailable: string;
    noMembership: string;
    disabled: string;
    errorTitle: string;
    retry: string;
  };
  nav: {
    bannerTitle: string;
    bannerSubtitle: string;
    bannerOpen: string;
  };
  digest: {
    title: string;
    subtitle: string;
    composeButton: string;
    loading: string;
    retry: string;
    copyHint: string;
    errorFallback: string;
  };
  roles: {
    staff: string;
    manager: string;
    owner: string;
    operator: string;
  };
  imports: {
    title: string;
    introNotice: string;
    filenameLabel: string;
    csvLabel: string;
    parseButton: string;
    rowCount: (n: number) => string;
    previewCap: (visible: number, total: number) => string;
    parseMissingName: string;
    parseMissingNameCell: (row: number) => string;
    parseMalformed: string;
    parseInvalidNumber: (row: number, column: string) => string;
    parseNumericColumn: Record<"quantity" | "price", string>;
    uploadButton: string;
    uploading: string;
    uploadSuccess: string;
    batchesTitle: string;
    batchesLoading: string;
    batchesEmpty: string;
    retry: string;
    batchPending: (n: number) => string;
    batchTotal: (n: number) => string;
    batchStatus: Record<"uploaded" | "needs_review" | "completed", string>;
    recordsTitle: string;
    recordsLoading: string;
    recordsEmpty: string;
    rawBarcode: (value: string) => string;
    rawQuantity: (value: number) => string;
    rawPrice: (value: number) => string;
    rawQuantityLabelMissing: string;
    rawPriceLabelMissing: string;
    missingValue: string;
    matchStatus: Record<"auto_matched" | "ambiguous" | "unmatched" | "approved" | "rejected", string>;
    candidatesTitle: string;
    candidateReason: Record<"barcode" | "alias" | "product_name" | "duplicate_in_file", string>;
    selectedCandidate: string;
    selectCandidate: string;
    approveSelected: string;
    approveNew: string;
    reject: string;
    deciding: string;
    decisionSuccess: string;
    staffReviewNote: string;
    uploadForbidden: string;
  };
  inventory: {
    title: string;
    itemCount: (n: number) => string;
    loadingItems: string;
    emptyTitle: string;
    emptyHint: string;
    errorTitle: string;
    retry: string;
    confidenceHigh: string;
    confidenceMedium: string;
    confidenceLow: string;
    lastVerified: (timestamp: string) => string;
    neverVerified: string;
    barcodeLabel: (code: string) => string;
    expiryLabel: (date: string) => string;
    onHandLabel: (n: number) => string;
    maxOfferableLabel: (n: number) => string;
    exceptionsSummary: (n: number) => string;
    noExceptions: string;
    exceptionActionButton: string;
    recordCountButton: string;
    publishButton: string;
    offersButton: string;
    pickupsButton: string;
    importButton: string;
  };
  expiry: {
    title: string;
    itemCount: (n: number) => string;
    loading: string;
    emptyTitle: string;
    emptyHint: string;
    errorTitle: string;
    retry: string;
    expiryLabel: (date: string) => string;
    daysLabel: (days: number) => string;
    onHandLabel: (n: number) => string;
    openException: string;
    activeOffer: string;
    recountAction: string;
    publishAction: string;
  };
  exceptions: {
    title: string;
    loading: string;
    empty: string;
    loadError: string;
    retry: string;
    kindLabel: Record<
      "stock_mismatch" | "import_conflict" | "expiry_risk" | "closeout_missed",
      string
    >;
    createdLabel: (timestamp: string) => string;
    openStatus: string;
    resolvedStatus: string;
    resolveButton: string;
    noteLabel: string;
    noteRequired: string;
    submitButton: string;
    submitButtonDefault: string;
    resolving: string;
    resolvedSuccess: string;
    resolutionNoteLabel: (note: string) => string;
    resolvedAtLabel: (timestamp: string) => string;
    errorNotFound: string;
    errorForbidden: string;
    errorValidationFailed: string;
    errorVersionConflict: string;
    errorInvalidState: string;
    errorIdempotencyConflict: string;
    errorSoldOut: string;
    errorOfferNotLive: string;
    errorAllocationExceeded: string;
    errorNetwork: string;
    errorUnknown: string;
  };
  count: {
    title: string;
    forbiddenTitle: string;
    forbiddenMessage: string;
    selectProductsTitle: string;
    selectLabel: string;
    selectedLabel: string;
    observedQuantityLabel: string;
    submitButton: string;
    submitting: string;
    submitErrorFallback: string;
    retry: string;
    proposalsTitle: string;
    noChangesTitle: string;
    proposalLine: (current: number, proposed: number) => string;
    pendingApproval: string;
    approveButton: string;
    rejectButton: string;
    deciding: string;
    approvedLabel: string;
    appliedLabel: string;
    rejectedLabel: string;
    staleTitle: string;
    staleMessage: string;
    alreadyDecidedTitle: string;
    decisionErrorFallback: string;
  };
  publish: {
    title: string;
    forbiddenTitle: string;
    forbiddenMessage: string;
    selectProductTitle: string;
    noEligibleProducts: string;
    productExpiryLabel: (date: string) => string;
    quantityLabel: string;
    maxOfferableHint: (n: number) => string;
    quantityExceedsMaxHint: string;
    physicalSetAsideLabel: string;
    physicalSetAsideHint: string;
    physicalSetAsideRequiredHint: string;
    titleLabel: string;
    categoryLabel: string;
    categoryRequiredHint: string;
    imageUrlLabel: string;
    contentsLabel: string;
    contentsPlaceholder: string;
    priceLabel: string;
    referencePriceLabel: string;
    pickupStartLabel: string;
    pickupEndLabel: string;
    pickupWindowInvalidHint: string;
    allergensLabel: string;
    dietaryBadgesLabel: string;
    pickupInstructionsLabel: string;
    cancellationPolicyLabel: string;
    reviewButton: string;
    backButton: string;
    reviewTitle: string;
    reviewProduct: (name: string) => string;
    reviewQuantity: (n: number) => string;
    reviewPrice: (price: number) => string;
    reviewReferencePrice: (price: number) => string;
    reviewNoReferencePrice: string;
    reviewCategory: (category: string) => string;
    reviewContents: (joined: string) => string;
    reviewNoContents: string;
    reviewAllergens: (joined: string) => string;
    reviewNoAllergens: string;
    reviewDietaryBadges: (joined: string) => string;
    reviewNoDietaryBadges: string;
    reviewImageAttached: string;
    reviewNoImage: string;
    reviewPickupInstructions: (text: string) => string;
    reviewNoPickupInstructions: string;
    reviewCancellationPolicy: (text: string) => string;
    reviewNoCancellationPolicy: string;
    reviewPickupWindow: (start: string, end: string) => string;
    reviewSetAsideConfirmed: string;
    confirmButton: string;
    publishing: string;
    publishedTitle: string;
    publishedQuantity: (n: number) => string;
    publishedDiscount: (percent: number) => string;
    publishedNoDiscount: string;
    errorFallback: string;
    retry: string;
    pauseButton: string;
    pausing: string;
    pausedLabel: string;
    pauseErrorFallback: string;
  };
  offers: {
    title: string;
    loading: string;
    emptyTitle: string;
    emptyHint: string;
    errorTitle: string;
    retry: string;
    statusLabel: Record<
      "live" | "paused" | "sold_out" | "expired" | "withdrawn",
      string
    >;
    pickupWindowLabel: (start: string, end: string) => string;
    quantityLabel: (n: number) => string;
    pauseButton: string;
    pausing: string;
    pausedLabel: string;
    pauseErrorFallback: string;
  };
  pickups: {
    title: string;
    loading: string;
    loadError: string;
    loadForbidden: string;
    loadNotFound: string;
    loadErrorFallback: string;
    retry: string;
    pendingSegment: (n: number) => string;
    terminalSegment: (n: number) => string;
    emptyPending: string;
    emptyTerminal: string;
    fulfillTitle: string;
    codePrivacyHint: string;
    codePlaceholder: string;
    fulfillButton: string;
    fulfilling: string;
    fulfilledSuccess: string;
    managerOnly: string;
    codeHint: (hint: string) => string;
    pickupWindow: (start: string, end: string) => string;
    statusLabel: Record<
      | "held"
      | "fulfilled"
      | "cancelled_by_buyer"
      | "cancelled_by_seller"
      | "expired_no_show"
      | "failed_stock_mismatch",
      string
    >;
    errorNotFound: string;
    errorInvalidState: string;
    errorForbidden: string;
    errorNetwork: string;
    errorFallback: string;
    reportMismatchButton: string;
    mismatchTitle: string;
    mismatchSafetyHint: string;
    observedQuantityLabel: string;
    mismatchReasonLabel: string;
    mismatchReasonRequired: string;
    mismatchSubmitButton: string;
    mismatchSubmitting: string;
    mismatchAwaitingConfirmation: string;
    mismatchConfirmed: string;
    mismatchNetworkError: string;
    mismatchInvalidStateError: string;
    mismatchForbiddenError: string;
    mismatchNotFoundError: string;
    mismatchErrorFallback: string;
    recountGuidance: string;
    recountButton: string;
  };
}

export const sellerEn: SellerTranslations = {
  access: {
    loading: "Checking Shop Seller beta access...",
    unavailable: "Shop Seller beta is not available yet.",
    noMembership: "You are not a member of a Shop Seller beta store.",
    disabled: "Shop Seller beta is not enabled for your store yet.",
    errorTitle: "Unable to check Shop Seller beta access",
    retry: "Retry",
  },
  nav: {
    bannerTitle: "Shop Seller beta",
    bannerSubtitle:
      "Verified inventory, backend approved offers, and safe pickup fulfillment.",
    bannerOpen: "Open Shop Seller beta",
  },
  digest: {
    title: "Daily owner brief",
    subtitle: "Current action items and raw seven-day operating counts.",
    composeButton: "сводка дня",
    loading: "Preparing the brief...",
    retry: "Retry",
    copyHint: "Press and hold the text, then choose Copy.",
    errorFallback: "Unable to prepare the daily brief.",
  },
  roles: {
    staff: "Staff",
    manager: "Manager",
    owner: "Owner",
    operator: "Operator",
  },
  imports: {
    title: "CSV import",
    introNotice: "Quantities from the file are saved as observations. To change stock, run a count session. After import, the product needs a count session before it can back an offer.",
    filenameLabel: "Filename",
    csvLabel: "CSV content",
    parseButton: "Parse CSV",
    rowCount: (n) => `${n} row${n === 1 ? "" : "s"} found`,
    previewCap: (visible, total) => `Showing the first ${visible} of ${total} rows`,
    parseMissingName: "A name header is required",
    parseMissingNameCell: (row) => `Row ${row}: enter a product name`,
    parseMalformed: "The CSV contains an unclosed or misplaced quote",
    parseInvalidNumber: (row, column) =>
      `Row ${row}, column ${column}: the numeric value is invalid`,
    parseNumericColumn: {
      quantity: "Quantity",
      price: "Price",
    },
    uploadButton: "Upload batch",
    uploading: "Uploading...",
    uploadSuccess: "The store service confirmed the batch",
    batchesTitle: "Import batches",
    batchesLoading: "Loading import batches...",
    batchesEmpty: "No import batches yet",
    retry: "Retry",
    batchPending: (n) => `Awaiting review: ${n}`,
    batchTotal: (n) => `Total rows: ${n}`,
    batchStatus: {
      uploaded: "Uploaded",
      needs_review: "Needs review",
      completed: "Completed",
    },
    recordsTitle: "Staged records",
    recordsLoading: "Loading staged records...",
    recordsEmpty: "This batch has no staged records",
    rawBarcode: (value) => `Barcode: ${value}`,
    rawQuantity: (value) => `Quantity: ${value}`,
    rawPrice: (value) => `Price: ${value}`,
    rawQuantityLabelMissing: "Quantity: not supplied",
    rawPriceLabelMissing: "Price: not supplied",
    missingValue: "Not supplied",
    matchStatus: {
      auto_matched: "Automatic match",
      ambiguous: "Ambiguous match",
      unmatched: "No match",
      approved: "Approved",
      rejected: "Rejected",
    },
    candidatesTitle: "Candidates",
    candidateReason: {
      barcode: "Barcode match",
      alias: "Alias match",
      product_name: "Name match",
      duplicate_in_file: "Duplicate barcode in this file",
    },
    selectedCandidate: "Selected",
    selectCandidate: "Select",
    approveSelected: "Approve selected",
    approveNew: "Approve as new product",
    reject: "Reject",
    deciding: "Saving decision...",
    decisionSuccess: "Decision saved. After import, the product needs a count session before it can back an offer.",
    staffReviewNote: "Staff can review rows. A manager or owner makes the decision",
    uploadForbidden: "Your role can review imports but cannot upload a CSV batch",
  },
  inventory: {
    title: "Shop Seller beta inventory",
    itemCount: (n) => `${n} product${n === 1 ? "" : "s"} tracked`,
    loadingItems: "Loading inventory...",
    emptyTitle: "No tracked products yet",
    emptyHint: "Products appear here after a canonical import or manual entry.",
    errorTitle: "Unable to load inventory",
    retry: "Retry",
    confidenceHigh: "High confidence",
    confidenceMedium: "Medium confidence",
    confidenceLow: "Low confidence",
    lastVerified: (timestamp) => `Verified ${timestamp}`,
    neverVerified: "Never verified",
    barcodeLabel: (code) => `Barcode ${code}`,
    expiryLabel: (date) => `Expires ${date}`,
    onHandLabel: (n) => `${n} on hand`,
    maxOfferableLabel: (n) => `Up to ${n} offerable`,
    exceptionsSummary: (n) =>
      n === 0
        ? "No open exceptions"
        : `${n} item${n === 1 ? "" : "s"} need${n === 1 ? "s" : ""} attention`,
    noExceptions: "No open exceptions",
    exceptionActionButton: "Recount",
    recordCountButton: "Record a count",
    publishButton: "New offer",
    offersButton: "View offers",
    pickupsButton: "Pickup queue",
    importButton: "Import CSV",
  },
  expiry: {
    title: "Expiry watchlist",
    itemCount: (n) => `${n} product${n === 1 ? "" : "s"} need attention`,
    loading: "Loading expiry watchlist...",
    emptyTitle: "No products expire within the next 14 days",
    emptyHint: "Products without an expiry date are not included in this watchlist.",
    errorTitle: "Unable to load the expiry watchlist",
    retry: "Retry",
    expiryLabel: (date) => `Expiry date ${date}`,
    daysLabel: (days) =>
      days < 0
        ? `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`
        : days === 0
          ? "Expires today"
          : `${days} day${days === 1 ? "" : "s"} remaining`,
    onHandLabel: (n) => `${n} on hand`,
    openException: "Open exception",
    activeOffer: "Live or paused offer exists",
    recountAction: "пересчитать сначала",
    publishAction: "Open offer flow",
  },
  exceptions: {
    title: "Store exceptions",
    loading: "Loading exceptions...",
    empty: "No exceptions have been recorded.",
    loadError: "Unable to load store exceptions. Check your connection and retry.",
    retry: "Retry",
    kindLabel: {
      stock_mismatch: "Stock mismatch",
      import_conflict: "Import conflict",
      expiry_risk: "Expiry risk",
      closeout_missed: "Closeout missed",
    },
    createdLabel: (timestamp) => `Created ${timestamp}`,
    openStatus: "Open",
    resolvedStatus: "Resolved",
    resolveButton: "Resolve exception",
    noteLabel: "Resolution note",
    noteRequired: "Enter what was checked and how the exception was resolved.",
    submitButton: "Resolve and release units",
    submitButtonDefault: "Resolve exception",
    resolving: "Resolving...",
    resolvedSuccess: "Exception resolved.",
    resolutionNoteLabel: (note) => `Resolution: ${note}`,
    resolvedAtLabel: (timestamp) => `Resolved ${timestamp}`,
    errorNotFound: "This exception no longer exists in this store. Refresh the list.",
    errorForbidden: "Only a manager or owner can resolve this exception.",
    errorValidationFailed: "The exception was not resolved. Enter a valid resolution note.",
    errorVersionConflict: "The exception changed before this action finished. Refresh the list.",
    errorInvalidState: "This exception is already resolved. Refresh the list for its latest state.",
    errorIdempotencyConflict:
      "This resolution is already being processed or its action key was reused. Wait, then refresh.",
    errorSoldOut: "The service reported sold out instead of resolving the exception. Refresh and retry.",
    errorOfferNotLive:
      "The related offer is not live. Refresh the exception before trying again.",
    errorAllocationExceeded:
      "The service reported an allocation limit and did not resolve the exception. Refresh and retry.",
    errorNetwork: "The resolution was not confirmed. Check your connection and retry the same action.",
    errorUnknown: "The resolution was not confirmed. Refresh the list before trying again.",
  },
  count: {
    title: "Count session",
    forbiddenTitle: "Counts are staff, manager, and owner only",
    forbiddenMessage: "Your role cannot record a physical count for this store.",
    selectProductsTitle: "Select the products you physically counted",
    selectLabel: "Select",
    selectedLabel: "Selected",
    observedQuantityLabel: "Observed quantity",
    submitButton: "Submit count",
    submitting: "Submitting count...",
    submitErrorFallback: "Unable to submit this count.",
    retry: "Retry",
    proposalsTitle: "Adjustment proposals",
    noChangesTitle: "No changes, every observed quantity matched on hand stock.",
    proposalLine: (current, proposed) => `${current} on record, ${proposed} counted`,
    pendingApproval: "Awaiting manager approval",
    approveButton: "Approve",
    rejectButton: "Reject",
    deciding: "Saving decision...",
    approvedLabel: "Approved, stock update pending",
    appliedLabel: "Approved, stock updated",
    rejectedLabel: "Rejected",
    staleTitle: "This proposal changed",
    staleMessage: "Someone else decided this proposal first. Refreshed to the latest version.",
    alreadyDecidedTitle: "Already decided",
    decisionErrorFallback: "Unable to save this decision.",
  },
  publish: {
    title: "New offer",
    forbiddenTitle: "Publishing is manager and owner only",
    forbiddenMessage: "Your role cannot approve or publish an offer for this store.",
    selectProductTitle: "Select the inventory this offer allocates",
    noEligibleProducts: "No inventory is currently eligible to publish.",
    productExpiryLabel: (date) => `Expires ${date}`,
    quantityLabel: "Quantity",
    maxOfferableHint: (n) => `Up to ${n} available without physical set aside`,
    quantityExceedsMaxHint: "Quantity is above the safe maximum for this product.",
    physicalSetAsideLabel: "I physically set this quantity aside for pickup",
    physicalSetAsideHint:
      "Confidence is not high, publishing requires a confirmed physical set aside.",
    physicalSetAsideRequiredHint: "Confirm the physical set aside before continuing.",
    titleLabel: "Offer title",
    categoryLabel: "Category",
    categoryRequiredHint: "Enter a category before you can review this offer.",
    imageUrlLabel: "Image URL",
    contentsLabel: "Contents, one line per item",
    contentsPlaceholder: "Bread\nPastry",
    priceLabel: "Offer price, UZS",
    referencePriceLabel: "Supported reference price, UZS, optional",
    pickupStartLabel: "Pickup start",
    pickupEndLabel: "Pickup end",
    pickupWindowInvalidHint: "Pickup end must be after pickup start.",
    allergensLabel: "Allergens, one line per item",
    dietaryBadgesLabel: "Dietary badges, one line per item",
    pickupInstructionsLabel: "Pickup instructions",
    cancellationPolicyLabel: "Cancellation policy",
    reviewButton: "Review before publishing",
    backButton: "Back to edit",
    reviewTitle: "Review before you approve",
    reviewProduct: (name) => `Allocation: ${name}`,
    reviewQuantity: (n) => `Quantity: ${n}`,
    reviewPrice: (price) => `Offer price: UZS ${price}`,
    reviewReferencePrice: (price) => `Reference price: UZS ${price}`,
    reviewNoReferencePrice: "No reference price, no discount will be shown",
    reviewCategory: (category) => `Category: ${category}`,
    reviewContents: (joined) => `Contents: ${joined}`,
    reviewNoContents: "Contents: none listed",
    reviewAllergens: (joined) => `Allergens: ${joined}`,
    reviewNoAllergens: "Allergens: none listed",
    reviewDietaryBadges: (joined) => `Dietary badges: ${joined}`,
    reviewNoDietaryBadges: "Dietary badges: none listed",
    reviewImageAttached: "Image attached",
    reviewNoImage: "No image attached",
    reviewPickupInstructions: (text) => `Pickup instructions: ${text}`,
    reviewNoPickupInstructions: "Pickup instructions: none given",
    reviewCancellationPolicy: (text) => `Cancellation policy: ${text}`,
    reviewNoCancellationPolicy: "Cancellation policy: none given",
    reviewPickupWindow: (start, end) => `Pickup ${start} to ${end}`,
    reviewSetAsideConfirmed: "Physical set aside confirmed",
    confirmButton: "Approve and publish",
    publishing: "Publishing...",
    publishedTitle: "Offer live",
    publishedQuantity: (n) => `${n} available`,
    publishedDiscount: (percent) => `${percent}% off the reference price`,
    publishedNoDiscount: "No discount, no reference price was supplied",
    errorFallback: "Unable to publish this offer.",
    retry: "Retry",
    pauseButton: "Pause offer",
    pausing: "Pausing...",
    pausedLabel: "Paused",
    pauseErrorFallback: "Unable to pause this offer.",
  },
  offers: {
    title: "Store offers",
    loading: "Loading offers...",
    emptyTitle: "No offers published yet",
    emptyHint: "Publish an inventory backed offer to see it here.",
    errorTitle: "Unable to load offers",
    retry: "Retry",
    statusLabel: {
      expired: "Expired",
      live: "Live",
      paused: "Paused",
      sold_out: "Sold out",
      withdrawn: "Withdrawn",
    },
    pickupWindowLabel: (start, end) => `Pickup ${start} to ${end}`,
    quantityLabel: (n) => `${n} available`,
    pauseButton: "Pause",
    pausing: "Pausing...",
    pausedLabel: "Paused",
    pauseErrorFallback: "Unable to pause this offer.",
  },
  pickups: {
    title: "Pickup queue",
    loading: "Loading pickups...",
    loadError: "Unable to load pickups. Check your connection and retry.",
    loadForbidden: "You no longer have access to this store's pickup queue.",
    loadNotFound: "This store's pickup queue could not be found.",
    loadErrorFallback: "Unable to load pickups. Refresh and try again.",
    retry: "Retry",
    pendingSegment: (n) => `Pending (${n})`,
    terminalSegment: (n) => `Completed (${n})`,
    emptyPending: "No active pickups are waiting.",
    emptyTerminal: "No completed pickups yet.",
    fulfillTitle: "Fulfill by pickup code",
    codePrivacyHint: "Enter the buyer's full code. It is sent only for this fulfillment check.",
    codePlaceholder: "Full pickup code",
    fulfillButton: "Confirm pickup",
    fulfilling: "Confirming pickup...",
    fulfilledSuccess: "Pickup confirmed by the store service.",
    managerOnly: "Managers and owners confirm pickups. You can still view the queue.",
    codeHint: (hint) => `Code ends in ${hint}`,
    pickupWindow: (start, end) => `Pickup ${start} to ${end}`,
    statusLabel: {
      held: "Waiting for pickup",
      fulfilled: "Fulfilled",
      cancelled_by_buyer: "Cancelled by buyer",
      cancelled_by_seller: "Cancelled by seller",
      expired_no_show: "Expired, no show",
      failed_stock_mismatch: "Failed, stock mismatch",
    },
    errorNotFound: "No active pickup matches that code. Check the full code and try again.",
    errorInvalidState:
      "This reservation is no longer active. The queue has been refreshed with its latest state.",
    errorForbidden: "Only a manager or owner can confirm this pickup.",
    errorNetwork: "The pickup was not confirmed. Check your connection and retry the same action.",
    errorFallback: "The pickup was not confirmed. Refresh the queue before trying again.",
    reportMismatchButton: "Report stock mismatch",
    mismatchTitle: "Pause availability for a stock mismatch",
    mismatchSafetyHint:
      "Submitting asks the store service to pause the offer and fail its active reservations.",
    observedQuantityLabel: "Observed quantity",
    mismatchReasonLabel: "Reason for the mismatch",
    mismatchReasonRequired: "Enter a reason before reporting this mismatch.",
    mismatchSubmitButton: "Report mismatch and pause offer",
    mismatchSubmitting: "Reporting mismatch...",
    mismatchAwaitingConfirmation: "Waiting for the store service to confirm the pause.",
    mismatchConfirmed: "Offer paused after the stock mismatch was confirmed.",
    mismatchNetworkError:
      "The mismatch was not confirmed. Check your connection and retry the same action.",
    mismatchInvalidStateError:
      "The offer changed before this report was accepted. No local pause was applied.",
    mismatchForbiddenError: "Only a manager or owner can report this stock mismatch.",
    mismatchNotFoundError: "This offer could not be found. Refresh the pickup queue.",
    mismatchErrorFallback: "The mismatch was not confirmed. No local pause was applied.",
    recountGuidance:
      "Investigate the mismatch, then resolve the exception in the inventory screen. The failed reservation units return to the offerable quantity after resolution.",
    recountButton: "Start recount",
  },
};

export const sellerRu: SellerTranslations = {
  access: {
    loading: "Проверяем доступ к бета-версии для магазинов...",
    unavailable: "Бета-версия для магазинов пока недоступна.",
    noMembership: "Вы не состоите в магазине бета-программы.",
    disabled: "Бета-версия для магазинов не включена для вашего магазина.",
    errorTitle: "Не удалось проверить доступ к бета-версии",
    retry: "Повторить",
  },
  nav: {
    bannerTitle: "Бета-версия для магазинов",
    bannerSubtitle:
      "Проверенные остатки, предложения с подтверждением бэкенда и безопасная выдача.",
    bannerOpen: "Открыть бета-версию",
  },
  digest: {
    title: "Сводка владельца",
    subtitle: "Текущие задачи и фактические показатели за семь дней.",
    composeButton: "сводка дня",
    loading: "Формируем сводку...",
    retry: "Повторить",
    copyHint: "Нажмите и удерживайте текст, затем выберите «Копировать».",
    errorFallback: "Не удалось сформировать сводку дня.",
  },
  roles: {
    staff: "Сотрудник",
    manager: "Менеджер",
    owner: "Владелец",
    operator: "Оператор",
  },
  imports: {
    title: "Импорт CSV",
    introNotice: "Количество из файла сохраняется как наблюдение. Чтобы изменить остаток, проведите пересчёт. После импорта товар нужно пересчитать, прежде чем использовать его для оффера.",
    filenameLabel: "Имя файла",
    csvLabel: "Содержимое CSV",
    parseButton: "Проверить CSV",
    rowCount: (n) => `Найдено строк: ${n}`,
    previewCap: (visible, total) => `Показаны первые ${visible} из ${total} строк`,
    parseMissingName: "Нужен столбец с названием товара",
    parseMissingNameCell: (row) => `Строка ${row}: укажите название товара`,
    parseMalformed: "В CSV есть незакрытая или неверно расположенная кавычка",
    parseInvalidNumber: (row, column) =>
      `Строка ${row}, столбец ${column}: недопустимое числовое значение`,
    parseNumericColumn: {
      quantity: "Количество",
      price: "Цена",
    },
    uploadButton: "Загрузить пакет",
    uploading: "Загружаем...",
    uploadSuccess: "Пакет подтверждён сервисом магазина",
    batchesTitle: "Пакеты импорта",
    batchesLoading: "Загружаем пакеты импорта...",
    batchesEmpty: "Пакетов импорта пока нет",
    retry: "Повторить",
    batchPending: (n) => `Ожидают проверки: ${n}`,
    batchTotal: (n) => `Всего строк: ${n}`,
    batchStatus: {
      uploaded: "Загружен",
      needs_review: "Требует проверки",
      completed: "Завершён",
    },
    recordsTitle: "Строки на проверке",
    recordsLoading: "Загружаем строки на проверке...",
    recordsEmpty: "В этом пакете нет строк",
    rawBarcode: (value) => `Штрих-код: ${value}`,
    rawQuantity: (value) => `Количество: ${value}`,
    rawPrice: (value) => `Цена: ${value}`,
    rawQuantityLabelMissing: "Количество: не указано",
    rawPriceLabelMissing: "Цена: не указана",
    missingValue: "Не указано",
    matchStatus: {
      auto_matched: "Автоматическое совпадение",
      ambiguous: "Неоднозначное совпадение",
      unmatched: "Совпадений нет",
      approved: "Одобрено",
      rejected: "Отклонено",
    },
    candidatesTitle: "Варианты совпадения",
    candidateReason: {
      barcode: "Совпадение по штрих-коду",
      alias: "Совпадение по псевдониму",
      product_name: "Совпадение по названию",
      duplicate_in_file: "Повторяющийся штрих-код в этом файле",
    },
    selectedCandidate: "Выбрано",
    selectCandidate: "Выбрать",
    approveSelected: "Одобрить выбранный товар",
    approveNew: "Одобрить как новый товар",
    reject: "Отклонить",
    deciding: "Сохраняем решение...",
    decisionSuccess: "Решение сохранено. После импорта товар нужно пересчитать, прежде чем использовать его для оффера.",
    staffReviewNote: "Сотрудники могут проверять строки, решение принимает менеджер или владелец",
    uploadForbidden: "Ваша роль позволяет проверять импорт, но не загружать пакет CSV",
  },
  inventory: {
    title: "Инвентарь бета-версии для магазинов",
    itemCount: (n) => `${n} ${pluralRu(n, "товар", "товара", "товаров")} на учёте`,
    loadingItems: "Загрузка инвентаря...",
    emptyTitle: "Товары ещё не добавлены",
    emptyHint: "Товары появятся здесь после импорта или ручного ввода.",
    errorTitle: "Не удалось загрузить инвентарь",
    retry: "Повторить",
    confidenceHigh: "Высокая уверенность",
    confidenceMedium: "Средняя уверенность",
    confidenceLow: "Низкая уверенность",
    lastVerified: (timestamp) => `Проверено ${timestamp}`,
    neverVerified: "Ещё не проверено",
    barcodeLabel: (code) => `Штрих-код ${code}`,
    expiryLabel: (date) => `Истекает ${date}`,
    onHandLabel: (n) => `${n} в наличии`,
    maxOfferableLabel: (n) => `Доступно к продаже: ${n}`,
    exceptionsSummary: (n) =>
      n === 0
        ? "Нет открытых расхождений"
        : `${n} ${pluralRu(n, "товар требует", "товара требуют", "товаров требуют")} внимания`,
    noExceptions: "Нет открытых расхождений",
    exceptionActionButton: "Пересчитать",
    recordCountButton: "Записать пересчёт",
    publishButton: "Новое предложение",
    offersButton: "Смотреть предложения",
    pickupsButton: "Очередь самовывоза",
    importButton: "Импортировать CSV",
  },
  expiry: {
    title: "Контроль сроков годности",
    itemCount: (n) =>
      `${n} ${pluralRu(n, "товар требует", "товара требуют", "товаров требуют")} внимания`,
    loading: "Загружаем товары по сроку годности...",
    emptyTitle: "Нет товаров со сроком годности в ближайшие 14 дней",
    emptyHint: "Товары без даты срока годности в этот список не входят.",
    errorTitle: "Не удалось загрузить контроль сроков",
    retry: "Повторить",
    expiryLabel: (date) => `Срок годности: ${date}`,
    daysLabel: (days) =>
      days < 0
        ? `Просрочено на ${Math.abs(days)} ${pluralRu(Math.abs(days), "день", "дня", "дней")}`
        : days === 0
          ? "Срок истекает сегодня"
          : `Осталось ${days} ${pluralRu(days, "день", "дня", "дней")}`,
    onHandLabel: (n) => `В наличии: ${n}`,
    openException: "Есть открытое исключение",
    activeOffer: "Есть активный или приостановленный оффер",
    recountAction: "пересчитать сначала",
    publishAction: "Открыть создание оффера",
  },
  exceptions: {
    title: "Исключения магазина",
    loading: "Загружаем исключения...",
    empty: "Исключений пока нет.",
    loadError: "Не удалось загрузить исключения. Проверьте соединение и повторите.",
    retry: "Повторить",
    kindLabel: {
      stock_mismatch: "Расхождение остатков",
      import_conflict: "Конфликт импорта",
      expiry_risk: "Риск истечения срока",
      closeout_missed: "Пропущено закрытие дня",
    },
    createdLabel: (timestamp) => `Создано ${timestamp}`,
    openStatus: "Открыто",
    resolvedStatus: "Закрыто",
    resolveButton: "Закрыть исключение",
    noteLabel: "Комментарий к решению",
    noteRequired: "Опишите, что вы проверили и как устранили расхождение.",
    submitButton: "Закрыть и освободить единицы",
    submitButtonDefault: "Закрыть исключение",
    resolving: "Закрываем...",
    resolvedSuccess: "Исключение закрыто.",
    resolutionNoteLabel: (note) => `Решение: ${note}`,
    resolvedAtLabel: (timestamp) => `Закрыто ${timestamp}`,
    errorNotFound: "Это исключение больше не найдено в магазине. Обновите список.",
    errorForbidden: "Закрыть исключение может только менеджер или владелец.",
    errorValidationFailed: "Исключение не закрыто. Добавьте корректный комментарий к решению.",
    errorVersionConflict: "Исключение изменилось во время операции. Обновите список.",
    errorInvalidState: "Это исключение уже закрыто. Обновите список, чтобы увидеть новый статус.",
    errorIdempotencyConflict:
      "Решение уже обрабатывается или ключ действия использован повторно. Подождите и обновите список.",
    errorSoldOut:
      "Сервис вернул статус распродажи вместо закрытия исключения. Обновите список и повторите.",
    errorOfferNotLive:
      "Связанное предложение не активно. Обновите исключение перед повторной попыткой.",
    errorAllocationExceeded:
      "Сервис сообщил об ограничении доступного количества и не закрыл исключение. Обновите список.",
    errorNetwork:
      "Закрытие не подтверждено. Проверьте соединение и повторите то же действие.",
    errorUnknown: "Закрытие не подтверждено. Обновите список перед повторной попыткой.",
  },
  count: {
    title: "Сессия пересчёта",
    forbiddenTitle: "Пересчёт доступен только сотрудникам, менеджерам и владельцам",
    forbiddenMessage: "Ваша роль не позволяет записывать физический пересчёт для этого магазина.",
    selectProductsTitle: "Выберите товары, которые вы физически пересчитали",
    selectLabel: "Выбрать",
    selectedLabel: "Выбрано",
    observedQuantityLabel: "Фактическое количество",
    submitButton: "Отправить пересчёт",
    submitting: "Отправка пересчёта...",
    submitErrorFallback: "Не удалось отправить этот пересчёт.",
    retry: "Повторить",
    proposalsTitle: "Предложения по корректировке",
    noChangesTitle: "Изменений нет, все фактические количества совпали с учётными.",
    proposalLine: (current, proposed) => `${current} по учёту, ${proposed} по пересчёту`,
    pendingApproval: "Ожидает решения менеджера",
    approveButton: "Одобрить",
    rejectButton: "Отклонить",
    deciding: "Сохраняем решение...",
    approvedLabel: "Одобрено, обновление остатка ожидается",
    appliedLabel: "Одобрено, остаток обновлён",
    rejectedLabel: "Отклонено",
    staleTitle: "Это предложение изменилось",
    staleMessage: "Кто-то другой уже принял решение по этому предложению. Показана последняя версия.",
    alreadyDecidedTitle: "Уже решено",
    decisionErrorFallback: "Не удалось сохранить это решение.",
  },
  publish: {
    title: "Новое предложение",
    forbiddenTitle: "Публикация доступна только менеджерам и владельцам",
    forbiddenMessage: "Ваша роль не позволяет одобрять или публиковать предложения для этого магазина.",
    selectProductTitle: "Выберите товар, под который выделяется предложение",
    noEligibleProducts: "Сейчас нет товаров, доступных для публикации.",
    productExpiryLabel: (date) => `Истекает ${date}`,
    quantityLabel: "Количество",
    maxOfferableHint: (n) => `Доступно без физического резерва: ${n}`,
    quantityExceedsMaxHint: "Количество превышает безопасный максимум для этого товара.",
    physicalSetAsideLabel: "Я физически отложил это количество для выдачи",
    physicalSetAsideHint:
      "Уверенность не высокая, публикация требует подтверждённого физического резерва.",
    physicalSetAsideRequiredHint: "Подтвердите физический резерв, чтобы продолжить.",
    titleLabel: "Название предложения",
    categoryLabel: "Категория",
    categoryRequiredHint: "Введите категорию, чтобы перейти к проверке предложения.",
    imageUrlLabel: "URL изображения",
    contentsLabel: "Состав, по одному пункту на строку",
    contentsPlaceholder: "Хлеб\nВыпечка",
    priceLabel: "Цена предложения, сум",
    referencePriceLabel: "Подтверждённая базовая цена, сум, необязательно",
    pickupStartLabel: "Начало самовывоза",
    pickupEndLabel: "Конец самовывоза",
    pickupWindowInvalidHint: "Конец самовывоза должен быть позже начала.",
    allergensLabel: "Аллергены, по одному на строку",
    dietaryBadgesLabel: "Диетические отметки, по одной на строку",
    pickupInstructionsLabel: "Инструкции по самовывозу",
    cancellationPolicyLabel: "Правила отмены",
    reviewButton: "Проверить перед публикацией",
    backButton: "Вернуться к редактированию",
    reviewTitle: "Проверьте перед одобрением",
    reviewProduct: (name) => `Резерв: ${name}`,
    reviewQuantity: (n) => `Количество: ${n}`,
    reviewPrice: (price) => `Цена предложения: ${price} сум`,
    reviewReferencePrice: (price) => `Базовая цена: ${price} сум`,
    reviewNoReferencePrice: "Без базовой цены скидка не будет показана",
    reviewCategory: (category) => `Категория: ${category}`,
    reviewContents: (joined) => `Состав: ${joined}`,
    reviewNoContents: "Состав: не указан",
    reviewAllergens: (joined) => `Аллергены: ${joined}`,
    reviewNoAllergens: "Аллергены: не указаны",
    reviewDietaryBadges: (joined) => `Диетические отметки: ${joined}`,
    reviewNoDietaryBadges: "Диетические отметки: не указаны",
    reviewImageAttached: "Изображение прикреплено",
    reviewNoImage: "Изображение не прикреплено",
    reviewPickupInstructions: (text) => `Инструкции по самовывозу: ${text}`,
    reviewNoPickupInstructions: "Инструкции по самовывозу: не указаны",
    reviewCancellationPolicy: (text) => `Правила отмены: ${text}`,
    reviewNoCancellationPolicy: "Правила отмены: не указаны",
    reviewPickupWindow: (start, end) => `Самовывоз с ${start} до ${end}`,
    reviewSetAsideConfirmed: "Физический резерв подтверждён",
    confirmButton: "Одобрить и опубликовать",
    publishing: "Публикация...",
    publishedTitle: "Предложение опубликовано",
    publishedQuantity: (n) => `Доступно: ${n}`,
    publishedDiscount: (percent) => `Скидка ${percent}% от базовой цены`,
    publishedNoDiscount: "Без скидки, базовая цена не была указана",
    errorFallback: "Не удалось опубликовать это предложение.",
    retry: "Повторить",
    pauseButton: "Приостановить предложение",
    pausing: "Приостановка...",
    pausedLabel: "Приостановлено",
    pauseErrorFallback: "Не удалось приостановить это предложение.",
  },
  offers: {
    title: "Предложения магазина",
    loading: "Загрузка предложений...",
    emptyTitle: "Предложения ещё не опубликованы",
    emptyHint: "Опубликуйте предложение на основе остатков, чтобы увидеть его здесь.",
    errorTitle: "Не удалось загрузить предложения",
    retry: "Повторить",
    statusLabel: {
      expired: "Истекло",
      live: "Активно",
      paused: "Приостановлено",
      sold_out: "Раскуплено",
      withdrawn: "Отозвано",
    },
    pickupWindowLabel: (start, end) => `Самовывоз с ${start} до ${end}`,
    quantityLabel: (n) => `Доступно: ${n}`,
    pauseButton: "Приостановить",
    pausing: "Приостановка...",
    pausedLabel: "Приостановлено",
    pauseErrorFallback: "Не удалось приостановить это предложение.",
  },
  pickups: {
    title: "Очередь самовывоза",
    loading: "Загрузка самовывозов...",
    loadError: "Не удалось загрузить самовывозы. Проверьте соединение и повторите.",
    loadForbidden: "У вас больше нет доступа к очереди самовывоза этого магазина.",
    loadNotFound: "Очередь самовывоза этого магазина не найдена.",
    loadErrorFallback: "Не удалось загрузить самовывозы. Обновите и повторите.",
    retry: "Повторить",
    pendingSegment: (n) => `Ожидают (${n})`,
    terminalSegment: (n) => `Завершены (${n})`,
    emptyPending: "Нет активных заказов, ожидающих выдачи.",
    emptyTerminal: "Завершённых самовывозов пока нет.",
    fulfillTitle: "Выдача по коду",
    codePrivacyHint: "Введите полный код покупателя. Он отправляется только для этой проверки выдачи.",
    codePlaceholder: "Полный код самовывоза",
    fulfillButton: "Подтвердить выдачу",
    fulfilling: "Подтверждение выдачи...",
    fulfilledSuccess: "Выдача подтверждена сервисом магазина.",
    managerOnly: "Выдачу подтверждают менеджеры и владельцы. Очередь доступна для просмотра.",
    codeHint: (hint) => `Код заканчивается на ${hint}`,
    pickupWindow: (start, end) => `Самовывоз с ${start} до ${end}`,
    statusLabel: {
      held: "Ожидает выдачи",
      fulfilled: "Выдано",
      cancelled_by_buyer: "Отменено покупателем",
      cancelled_by_seller: "Отменено продавцом",
      expired_no_show: "Срок истёк, покупатель не пришёл",
      failed_stock_mismatch: "Не выдано из-за расхождения остатков",
    },
    errorNotFound: "Активный самовывоз с таким кодом не найден. Проверьте полный код и повторите.",
    errorInvalidState:
      "Бронирование больше не активно. Очередь обновлена до актуального состояния.",
    errorForbidden: "Подтвердить эту выдачу может только менеджер или владелец.",
    errorNetwork: "Выдача не подтверждена. Проверьте соединение и повторите то же действие.",
    errorFallback: "Выдача не подтверждена. Обновите очередь перед повторной попыткой.",
    reportMismatchButton: "Сообщить о расхождении",
    mismatchTitle: "Приостановить доступность из-за расхождения",
    mismatchSafetyHint:
      "После отправки сервис магазина приостановит предложение и отметит активные бронирования как невыполненные.",
    observedQuantityLabel: "Фактическое количество",
    mismatchReasonLabel: "Причина расхождения",
    mismatchReasonRequired: "Укажите причину перед отправкой расхождения.",
    mismatchSubmitButton: "Сообщить и приостановить предложение",
    mismatchSubmitting: "Отправка расхождения...",
    mismatchAwaitingConfirmation: "Ожидаем подтверждение приостановки от сервиса магазина.",
    mismatchConfirmed: "Предложение приостановлено после подтверждения расхождения.",
    mismatchNetworkError:
      "Расхождение не подтверждено. Проверьте соединение и повторите то же действие.",
    mismatchInvalidStateError:
      "Предложение изменилось до принятия отчёта. Локальная приостановка не применялась.",
    mismatchForbiddenError: "Сообщить о расхождении может только менеджер или владелец.",
    mismatchNotFoundError: "Предложение не найдено. Обновите очередь самовывоза.",
    mismatchErrorFallback: "Расхождение не подтверждено. Локальная приостановка не применялась.",
    recountGuidance:
      "Разберитесь с расхождением и закройте исключение на экране остатков. После закрытия единицы из невыданных броней снова войдут в доступное количество.",
    recountButton: "Начать пересчёт",
  },
};
