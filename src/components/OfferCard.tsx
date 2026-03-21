"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Star, Clock, MapPin, Share, CheckCircle2, Heart, Leaf, TrendingDown, Droplets } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useEffect, useState } from "react"
import type { Offer } from "@/types/offer"
import { useT } from "@/i18n"
import { useFavorites, toggleFavorite } from "@/lib/favorites-store"

function useCountdown(
    endTime: string,
    fmt: { hoursMinLeft: (h: number, m: number) => string; minsLeft: (m: number) => string }
): { label: string; urgent: boolean } {
    const [label, setLabel] = useState("")
    const [urgent, setUrgent] = useState(false)

    useEffect(() => {
        function calc() {
            const now = new Date()
            const end = new Date()
            const [h, m] = endTime.split(":").map(Number)
            end.setHours(h, m, 0, 0)
            if (end.getTime() <= now.getTime()) end.setDate(end.getDate() + 1)
            const diff = end.getTime() - now.getTime()
            const hours = Math.floor(diff / (1000 * 60 * 60))
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
            setUrgent(diff < 30 * 60 * 1000)
            if (hours > 0) setLabel(fmt.hoursMinLeft(hours, mins))
            else setLabel(fmt.minsLeft(mins))
        }
        calc()
        const interval = setInterval(calc, 30_000)
        return () => clearInterval(interval)
    }, [endTime, fmt])

    return { label, urgent }
}

export function OfferCard({ offer }: { offer: Offer }) {
    const t = useT()
    const [isReserved, setIsReserved] = useState(false)
    const favorites = useFavorites()
    const isFavorited = favorites.includes(offer.id)
    const { label: countdownLabel, urgent: countdownUrgent } = useCountdown(offer.endTime, t.offer)

    const isLowStock = typeof offer.quantityAvailable === "number" && offer.quantityAvailable <= 3
    const moneySaved = (offer.oldPrice - offer.newPrice).toFixed(2)
    const co2Saved = 2.7
    const waterSaved = Math.round((offer.oldPrice - offer.newPrice) * 35)

    function handleFavoriteClick(e: React.MouseEvent) {
        e.stopPropagation()
        toggleFavorite(offer.id)
    }

    return (
        <Dialog onOpenChange={(open) => { if (!open) setIsReserved(false) }}>
            <DialogTrigger asChild>
                <Card className="flex h-full flex-col overflow-hidden cursor-pointer hover:shadow-lg transition-shadow duration-200 border-none group">
                    <div className="relative h-[200px] w-full overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={offer.image}
                            alt={offer.title}
                            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-3 right-3 flex flex-col gap-2">
                            <Badge variant="secondary" className="bg-secondary text-secondary-foreground hover:bg-secondary font-bold text-sm px-2 py-1 shadow-sm">
                                -{offer.discount}%
                            </Badge>
                            {offer.isSurpriseBag && (
                                <Badge variant="destructive" className="bg-destructive text-destructive-foreground hover:bg-destructive font-semibold shadow-sm text-xs">
                                    {t.offer.surprise}
                                </Badge>
                            )}
                            {isLowStock && (
                                <Badge className="bg-amber-500 text-white hover:bg-amber-500 font-semibold shadow-sm text-xs">
                                    {t.offer.onlyLeft(offer.quantityAvailable!)}
                                </Badge>
                            )}
                        </div>

                        {/* Favorites button */}
                        <button
                            type="button"
                            onClick={handleFavoriteClick}
                            className="absolute top-3 left-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm transition-all hover:bg-black/60"
                            aria-label={isFavorited ? t.offer.removeFromFavorites : t.offer.addToFavorites}
                        >
                            <Heart className={`h-4 w-4 transition-colors ${isFavorited ? "fill-red-500 text-red-500" : "text-white"}`} />
                        </button>

                        <div className={`absolute bottom-3 left-3 flex items-center gap-1.5 backdrop-blur-md text-white px-2.5 py-1.5 rounded-md text-sm font-medium ${countdownUrgent ? "bg-red-600/80" : "bg-black/60"}`}>
                            <Clock className={`w-4 h-4 ${countdownUrgent ? "text-white animate-pulse" : "text-secondary"}`} />
                            <span>{countdownLabel || `${t.offer.collectBy} ${offer.endTime}`}</span>
                        </div>
                    </div>

                    <CardContent className="flex flex-1 flex-col p-4 bg-card text-card-foreground">
                        <div className="flex justify-between items-start mb-1">
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{offer.restaurant}</p>
                            <div className="flex items-center gap-1">
                                <Star className="w-4 h-4 fill-secondary text-secondary" />
                                <span className="text-sm font-medium">{offer.rating}</span>
                            </div>
                        </div>

                        <h3 className="font-semibold text-lg line-clamp-1 mb-2">{offer.title}</h3>

                        {typeof offer.quantityAvailable === "number" && (
                            <div className="mb-3">
                                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                    <span>{t.offer.portionsLeft(offer.quantityAvailable)}</span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${offer.quantityAvailable <= 2 ? "bg-red-500" : offer.quantityAvailable <= 4 ? "bg-amber-500" : "bg-primary"}`}
                                        style={{ width: `${Math.min(100, (offer.quantityAvailable / 10) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="mt-auto flex items-center justify-between pt-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-bold text-primary">${offer.newPrice.toFixed(2)}</span>
                                <span className="text-sm text-muted-foreground line-through">${offer.oldPrice.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground text-sm">
                                <MapPin className="w-4 h-4" />
                                <span>{offer.distance}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden border-none gap-0 bg-background text-foreground">
                <ScrollArea className="max-h-[85vh]">
                    {isReserved ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center bg-primary/10 min-h-[400px]">
                            <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-6">
                                <CheckCircle2 className="w-10 h-10 text-primary" />
                            </div>
                            <h2 className="text-2xl font-bold mb-2">{t.offer.reserved}</h2>
                            <p className="text-muted-foreground mb-6">
                                {t.offer.qrMessage(offer.restaurant, offer.endTime)}
                            </p>
                            <div className="bg-white p-6 rounded-2xl shadow-sm mb-6">
                                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${offer.id}-mock`} alt={t.offer.qrAlt} className="w-[150px] h-[150px]" />
                            </div>
                            {/* Impact stats */}
                            <div className="w-full rounded-2xl border border-primary/20 bg-background p-4 text-left space-y-3">
                                <p className="text-xs font-bold uppercase tracking-widest text-primary">{t.offer.yourRescueImpact}</p>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="flex flex-col items-center gap-1 rounded-xl bg-green-50 p-3">
                                        <Leaf className="h-5 w-5 text-green-600" />
                                        <span className="text-base font-bold text-green-700">{co2Saved} kg</span>
                                        <span className="text-center text-[10px] text-green-600 leading-tight">{t.offer.co2Avoided}</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-1 rounded-xl bg-blue-50 p-3">
                                        <Droplets className="h-5 w-5 text-blue-600" />
                                        <span className="text-base font-bold text-blue-700">{waterSaved}L</span>
                                        <span className="text-center text-[10px] text-blue-600 leading-tight">{t.offer.waterSaved}</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-1 rounded-xl bg-amber-50 p-3">
                                        <TrendingDown className="h-5 w-5 text-amber-600" />
                                        <span className="text-base font-bold text-amber-700">${moneySaved}</span>
                                        <span className="text-center text-[10px] text-amber-600 leading-tight">{t.offer.youSavedStat}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="relative h-[250px] w-full">
                                <img src={offer.image} alt={offer.title} className="w-full h-full object-cover" />
                                <div className="absolute top-4 right-4 bg-white rounded-full p-2 shadow-sm cursor-pointer hover:bg-gray-100 transition">
                                    <Share className="w-5 h-5 text-gray-700" />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleFavoriteClick}
                                    className="absolute top-4 left-4 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm hover:bg-gray-100 transition"
                                >
                                    <Heart className={`h-5 w-5 ${isFavorited ? "fill-red-500 text-red-500" : "text-gray-700"}`} />
                                </button>
                            </div>

                            <div className="p-6 relative">
                                <Badge className="absolute -top-4 right-6 bg-secondary hover:bg-secondary text-white px-3 py-1 shadow-lg text-sm border-2 border-white">
                                    -{offer.discount}%
                                </Badge>

                                <DialogHeader className="text-left space-y-1 mt-2">
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{offer.restaurant}</p>
                                    <DialogTitle className="text-2xl font-bold">{offer.title}</DialogTitle>
                                    <div className="flex items-center gap-4 text-sm mt-2">
                                        <div className="flex items-center gap-1 text-muted-foreground">
                                            <Star className="w-4 h-4 fill-secondary text-secondary" />
                                            <span className="font-medium text-foreground">{offer.rating}</span>
                                            <span>({offer.reviews})</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-muted-foreground">
                                            <MapPin className="w-4 h-4" />
                                            <span>{offer.distance} {t.offer.away}</span>
                                        </div>
                                    </div>
                                </DialogHeader>

                                <div className="mt-6 p-4 bg-amber-50 rounded-xl flex items-center gap-3 border border-amber-100">
                                    <Clock className={`w-5 h-5 ${countdownUrgent ? "text-red-500 animate-pulse" : "text-amber-500"}`} />
                                    <div>
                                        <p className={`text-sm font-semibold ${countdownUrgent ? "text-red-900" : "text-amber-900"}`}>
                                            {t.offer.collectToday}{countdownLabel && <> · <span className={countdownUrgent ? "text-red-600 font-bold" : ""}>{countdownLabel}</span></>}
                                        </p>
                                        <p className="text-xs text-amber-700">{t.offer.pickupWindow(offer.pickupStart ?? "18:00", offer.endTime)}</p>
                                    </div>
                                </div>

                                {typeof offer.quantityAvailable === "number" && (
                                    <div className="mt-4 flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3">
                                        <span className="text-sm text-muted-foreground">{t.offer.portionsAvailable}</span>
                                        <span className={`text-sm font-semibold ${offer.quantityAvailable <= 2 ? "text-red-600" : offer.quantityAvailable <= 4 ? "text-amber-600" : "text-foreground"}`}>
                                            {offer.quantityAvailable <= 3 ? t.offer.onlyLeftDialog(offer.quantityAvailable) : t.offer.remaining(offer.quantityAvailable)}
                                        </span>
                                    </div>
                                )}

                                <div className="mt-6 space-y-3">
                                    <h4 className="font-semibold">{t.offer.whatYouMightGet}</h4>
                                    {offer.contents?.length ? (
                                        <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                                            {offer.contents.map((item) => (
                                                <li key={item}>- {item}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            {offer.isSurpriseBag ? t.offer.surpriseBagDesc : t.offer.regularDesc}
                                        </p>
                                    )}
                                </div>

                                {/* Pre-reservation impact teaser */}
                                <div className="mt-4 flex items-center gap-2 rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">
                                    <Leaf className="h-4 w-4 shrink-0 text-green-600" />
                                    <span>{t.offer.impactTeaser(co2Saved, waterSaved)}</span>
                                </div>

                                <div className="mt-8 pt-6 border-t flex items-center justify-between sticky bottom-0 bg-background/95 backdrop-blur-sm -mx-6 px-6 pb-2">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl font-bold text-primary">${offer.newPrice.toFixed(2)}</span>
                                            <span className="text-sm text-muted-foreground line-through">${offer.oldPrice.toFixed(2)}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">{t.offer.youSave(moneySaved)}</p>
                                    </div>
                                    <Button size="lg" className="px-8" onClick={() => setIsReserved(true)}>
                                        {t.offer.reserveNow}
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
