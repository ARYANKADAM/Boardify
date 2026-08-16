import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Testimonial from "@/models/Testimonial";

export async function GET() {
  try {
    await connectToDatabase();

    const testimonials = await Testimonial
      .find({})
      .sort({ createdAt: -1 });

    return NextResponse.json(
      { testimonials },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET testimonials error:", error);

    return NextResponse.json(
      { error: "Failed to fetch testimonials" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    await connectToDatabase();

    const body = await req.json();

    const {
      name,
      title,
      quote,
      rating,
      avatar,
    } = body;

    if (!name || !quote) {
      return NextResponse.json(
        { error: "Name and testimonial are required" },
        { status: 400 }
      );
    }

    const testimonial = await Testimonial.create({
      name,
      title: title || "",
      quote,
      rating: Number(rating) || 5,
      avatar: avatar || "",
    });

    return NextResponse.json(
      {
        message: "Testimonial added successfully",
        testimonial,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("POST testimonial error:", error);

    return NextResponse.json(
      { error: "Failed to add testimonial" },
      { status: 500 }
    );
  }
}