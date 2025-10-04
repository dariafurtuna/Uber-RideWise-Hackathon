from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Date, ForeignKey
)
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()

# --- Core entities ---

class City(Base):
    __tablename__ = "cities"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=True)

    earners = relationship("Earner", back_populates="city")
    merchants = relationship("Merchant", back_populates="city")


class Earner(Base):
    __tablename__ = "earners"

    earner_id = Column(String, primary_key=True)
    earner_type = Column(String)
    vehicle_type = Column(String)
    fuel_type = Column(String)
    is_ev = Column(Boolean)
    experience_months = Column(Integer)
    rating = Column(Float)
    status = Column(String)
    home_city_id = Column(Integer, ForeignKey("cities.id"))

    city = relationship("City", back_populates="earners")
    earnings_daily = relationship("EarningsDaily", back_populates="earner")
    incentives_weekly = relationship("IncentivesWeekly", back_populates="earner")
    rides = relationship("RidesTrip", back_populates="driver")
    orders = relationship("EatsOrder", back_populates="courier")
    wellness_metrics = relationship("WellnessMetric", back_populates="earner")


class Rider(Base):
    __tablename__ = "riders"

    rider_id = Column(String, primary_key=True)
    trip_frequency = Column(Integer)
    preferred_product = Column(String)
    payment_type = Column(String)

    rides = relationship("RidesTrip", back_populates="rider")


class Customer(Base):
    __tablename__ = "customers"

    customer_id = Column(String, primary_key=True)
    order_frequency = Column(Integer)
    payment_type = Column(String)

    orders = relationship("EatsOrder", back_populates="customer")


class Merchant(Base):
    __tablename__ = "merchants"

    merchant_id = Column(String, primary_key=True)
    city_id = Column(Integer, ForeignKey("cities.id"))
    lat = Column(Float)
    lon = Column(Float)
    hex_id9 = Column(String)

    city = relationship("City", back_populates="merchants")
    orders = relationship("EatsOrder", back_populates="merchant")

# --- Operational data ---

class RidesTrip(Base):
    __tablename__ = "rides_trips"

    ride_id = Column(String, primary_key=True)
    driver_id = Column(String, ForeignKey("earners.earner_id"))
    rider_id = Column(String, ForeignKey("riders.rider_id"))
    city_id = Column(Integer, ForeignKey("cities.id"))
    product = Column(String)
    vehicle_type = Column(String)
    is_ev = Column(Boolean)
    start_time = Column(String)
    end_time = Column(String)
    distance_km = Column(Float)
    duration_mins = Column(Integer)
    surge_multiplier = Column(Float)
    fare_amount = Column(Float)
    uber_fee = Column(Float)
    net_earnings = Column(Float)
    tips = Column(Float)
    payment_type = Column(String)
    date = Column(Date)

    driver = relationship("Earner", back_populates="rides")
    rider = relationship("Rider", back_populates="rides")


class EatsOrder(Base):
    __tablename__ = "eats_orders"

    order_id = Column(String, primary_key=True)
    courier_id = Column(String, ForeignKey("earners.earner_id"))
    customer_id = Column(String, ForeignKey("customers.customer_id"))
    merchant_id = Column(String, ForeignKey("merchants.merchant_id"))
    city_id = Column(Integer, ForeignKey("cities.id"))
    vehicle_type = Column(String)
    is_ev = Column(Boolean)
    start_time = Column(String)
    end_time = Column(String)
    distance_km = Column(Float)
    duration_mins = Column(Integer)
    basket_value_eur = Column(Float)
    delivery_fee_eur = Column(Float)
    tip_eur = Column(Float)
    net_earnings = Column(Float)
    payment_type = Column(String)
    date = Column(Date)

    courier = relationship("Earner", back_populates="orders")
    customer = relationship("Customer", back_populates="orders")
    merchant = relationship("Merchant", back_populates="orders")


# --- Aggregates and incentives ---

class EarningsDaily(Base):
    __tablename__ = "earnings_daily"

    id = Column(Integer, primary_key=True, autoincrement=True)
    earner_id = Column(String, ForeignKey("earners.earner_id"))
    city_id = Column(Integer, ForeignKey("cities.id"))
    date = Column(Date)
    trips_count = Column(Integer)
    rides_distance_km = Column(Float)
    rides_duration_mins = Column(Integer)
    rides_gross_fare = Column(Float)
    rides_net_earnings = Column(Float)
    rides_tips = Column(Float)
    orders_count = Column(Integer)
    eats_distance_km = Column(Float)
    eats_duration_mins = Column(Integer)
    eats_delivery_fee = Column(Float)
    eats_net_earnings = Column(Float)
    eats_tips = Column(Float)
    total_jobs = Column(Integer)
    total_net_earnings = Column(Float)
    total_tips = Column(Float)
    week = Column(String)

    earner = relationship("Earner", back_populates="earnings_daily")


class IncentivesWeekly(Base):
    __tablename__ = "incentives_weekly"

    id = Column(Integer, primary_key=True, autoincrement=True)
    earner_id = Column(String, ForeignKey("earners.earner_id"))
    week = Column(String)
    program = Column(String)
    target_jobs = Column(Integer)
    completed_jobs = Column(Integer)
    achieved = Column(Boolean)
    bonus_eur = Column(Float)

    earner = relationship("Earner", back_populates="incentives_weekly")


# --- Analytics tables (simplified) ---

class WeatherDaily(Base):
    __tablename__ = "weather_daily"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date)
    city_id = Column(Integer, ForeignKey("cities.id"))
    weather = Column(String)


class SurgeByHour(Base):
    __tablename__ = "surge_by_hour"

    id = Column(Integer, primary_key=True, autoincrement=True)
    city_id = Column(Integer, ForeignKey("cities.id"))
    hour = Column(Integer)
    surge_multiplier = Column(Float)


class CancellationRate(Base):
    __tablename__ = "cancellation_rates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    city_id = Column(Integer, ForeignKey("cities.id"))
    hexagon_id9 = Column(String)
    job_count = Column(Integer)
    cancellation_rate_pct = Column(Float)


class Heatmap(Base):
    __tablename__ = "heatmap"

    id = Column(Integer, primary_key=True, autoincrement=True)
    city_id = Column(Integer)
    map_id = Column(String)
    currency_code = Column(String)
    earnings_heatmap_type = Column(String)
    hexagon_id_9 = Column(String)
    predicted_eph = Column(Float)
    predicted_std = Column(Float)
    in_final_heatmap = Column(Boolean)


class WellnessMetric(Base):
    __tablename__ = "wellness_metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    earner_id = Column(String, ForeignKey("earners.earner_id"))
    date = Column(Date, nullable=False)
    steps = Column(Integer, nullable=True)
    calories_burned = Column(Integer, nullable=True)
    hours_slept = Column(Float, nullable=True)
    stress_level = Column(Integer, nullable=True)

    earner = relationship("Earner", back_populates="wellness_metrics")