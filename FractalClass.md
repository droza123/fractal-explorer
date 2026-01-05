// FractalStart, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null

// FractalStart.FractalClass

using System;

using System.Collections.Generic;

using System.Diagnostics;

using System.Linq;

using System.Numerics;

using FractalStart;



public class FractalClass

{

 	\[DebuggerNonUserCode]

 	public FractalClass()

 	{

 	}



 	public static void GetRGB(decimal x, decimal y, ref byte R, ref byte G, ref byte B, ICollection<MyColor> MyColorsCollection, int MxItr, double RealPart = 0.0, double ImgPart = 0.0)

 	{

 		int num = 0;

 		if (GenerateBitmap.ImMandelbrot)

 		{

 			Complex c = new Complex(Convert.ToDouble(x), Convert.ToDouble(y));

 			num = mandelbrot(c, MxItr);

 		}

 		if (GenerateBitmap.ImJulia)

 		{

 			Complex c2 = new Complex(RealPart, ImgPart);

 			num = Julia(c2, Convert.ToDouble(y), Convert.ToDouble(x), MxItr);

 		}

 		GenerateBitmap.BrotValues\[num] = checked(GenerateBitmap.BrotValues\[num] + 1);

 		if (num != MxItr)

 		{

 			R = MyColorsCollection.ElementAtOrDefault(num).R;

 			G = MyColorsCollection.ElementAtOrDefault(num).G;

 			B = MyColorsCollection.ElementAtOrDefault(num).B;

 		}

 		else

 		{

 			R = 0;

 			G = 0;

 			B = 0;

 		}

 	}



 	public static int mandelbrot(Complex c, int MxItr)

 	{

 		int i = 0;

 		Complex complex = Complex.Zero;

 		for (; i < MxItr; i = checked(i + 1))

 		{

 			if (!(complex.Magnitude <= 2.0))

 			{

 				break;

 			}

 			if (1 == 0)

 			{

 				break;

 			}

 			complex = complex \* complex + c;

 		}

 		return i;

 	}



 	public static int Julia(Complex c, double Y, double X, int MxItr)

 	{

 		int i = 0;

 		Complex complex = new Complex(Y, X);

 		for (; i < MxItr; i = checked(i + 1))

 		{

 			if (!(complex.Magnitude <= 2.0))

 			{

 				break;

 			}

 			if (1 == 0)

 			{

 				break;

 			}

 			switch (MyData.JuliaEqNumber)

 			{

 			case 1:

 				complex = complex \* complex + c;

 				break;

 			case 2:

 				complex = complex \* complex \* complex + c;

 				break;

 			case 3:

 				complex = complex \* complex \* complex \* complex + c;

 				break;

 			case 4:

 				complex = complex \* complex \* complex \* complex \* complex + c;

 				break;

 			case 5:

 				complex = (complex \* complex + c) / (complex - c);

 				break;

 			case 6:

 				complex = complex \* complex - (complex + c);

 				break;

 			case 7:

 				complex = complex \* complex \* complex - complex \* complex + complex + c;

 				break;

 			case 8:

 				complex = (1 + c) \* complex - c \* complex \* complex;

 				break;

 			case 9:

 				complex = complex \* complex \* complex / (1 + c \* complex \* complex);

 				break;

 			case 10:

 				complex = (complex - 1) \* (complex + 0.5) \* (complex \* complex - 1) + c;

 				break;

 			case 11:

 				complex = (complex \* complex + 1 + c) / (complex \* complex - 1 - c);

 				break;

 			case 12:

 				complex = Complex.Pow(complex, 1.5) + c;

 				break;

 			case 13:

 				complex = Complex.Exp(complex) - c;

 				break;

 			case 14:

 				complex = Complex.Pow(complex, 3.0) - 0.5 + c \* Complex.Exp(-complex);

 				break;

 			case 15:

 				complex = c \* complex - 1 + c \* Complex.Exp(-complex);

 				break;

 			case 16:

 				complex = (4 \* Complex.Pow(complex, 5.0) + c) / (5 \* Complex.Pow(complex, 4.0));

 				break;

 			case 17:

 				complex = Complex.Pow(complex, 5.0) - complex \* complex \* complex + complex + c;

 				break;

 			case 18:

 				complex = complex \* complex \* complex + complex + c;

 				break;

 			case 19:

 				complex = complex \* 2 \* Math.Sin(complex.Real) + c \* complex \* Math.Cos(complex.Imaginary) + c;

 				break;

 			case 20:

 				complex = complex \* Complex.Exp(-complex) + c;

 				break;

 			case 21:

 				complex = c \* Complex.Exp(-complex) + complex \* complex;

 				break;

 			case 22:

 				complex = (complex \* complex + c) \* (complex \* complex + c) + complex + c;

 				break;

 			case 23:

 				complex = (complex + Complex.Sin(complex)) \* (complex + Complex.Sin(complex)) + c;

 				break;

 			case 24:

 				complex = complex \* complex + c \* c \* c;

 				break;

 			case 25:

 				complex = (complex \* complex + c) / (complex \* complex - 1 - c);

 				break;

 			case 26:

 				complex = complex \* complex \* Math.Cos(complex.Imaginary) + c \* complex \* Math.Sin(complex.Real) + c;

 				break;

 			case 27:

 				complex = complex \* complex \* Math.Cos(complex.Real) + c \* complex \* Math.Sin(complex.Imaginary) + c;

 				break;

 			case 28:

 				complex = complex \* complex \* Math.Cos(complex.Magnitude) + c \* complex \* Math.Sin(complex.Magnitude) + c;

 				break;

 			case 29:

 				complex = Complex.Sin(complex \* complex) \* Complex.Tan(complex \* complex) + c;

 				break;

 			case 30:

 				complex = c \* complex \* complex + complex \* Complex.Pow(c, 2.0);

 				break;

 			case 31:

 				complex = Complex.Exp(Complex.Sin(Complex.Multiply(c, complex)));

 				break;

 			case 32:

 				complex = Complex.Multiply(c, Complex.Sin(complex) + Complex.Cos(complex));

 				break;

 			case 33:

 				complex = (complex \* complex + c) \* (complex \* complex + c) / (complex - c);

 				break;

 			case 34:

 				complex = c \* (Complex.Sin(complex) + Complex.Cos(complex)) \* (Complex.Pow(complex, 3.0) + complex + c);

 				break;

 			case 35:

 				complex = c \* Complex.Exp(complex) \* Complex.Cos(c \* complex);

 				break;

 			case 36:

 				complex = (complex \* complex \* complex + complex + c) \* c \* (Complex.Sin(complex) + Complex.Cos(complex));

 				break;

 			case 37:

 				complex = 1 - complex \* complex + Complex.Pow(complex, 4.0) / (2 + 4 \* complex) + c;

 				break;

 			case 38:

 				complex = complex \* complex + Complex.Pow(complex, 1.5) + c;

 				break;

 			case 39:

 				complex = 1 - complex \* complex + Complex.Pow(complex, 5.0) / (2 + 4 \* complex) + c;

 				break;

 			case 40:

 				complex = complex \* complex \* complex \* Complex.Exp(complex) + c;

 				break;

 			case 41:

 				complex = (complex + Complex.Sin(complex)) \* (complex + Complex.Sin(complex)) + c \* Complex.Exp(-complex) + complex \* complex + c;

 				break;

 			case 42:

 				complex = complex \* complex \* complex / (1 + c \* complex \* complex) + Complex.Exp(complex) - c;

 				break;

 			case 43:

 				complex = (complex + Complex.Sin(complex)) \* (complex + Complex.Sin(complex)) + c \* Complex.Exp(complex) + c;

 				break;

 			case 44:

 				complex = (complex \* complex \* complex + c) / (complex \* complex);

 				break;

 			case 45:

 				complex = (complex \* complex \* complex + c) / complex;

 				break;

 			case 46:

 				complex = Complex.Pow(complex - Complex.Sqrt(complex), 2.0) + c;

 				break;

 			case 47:

 				complex = (complex + c) \* (complex + c) + (complex + c);

 				break;

 			case 48:

 				complex = Complex.Pow(complex + c, 3.0) - Complex.Pow(complex + c, 2.0);

 				break;

 			case 49:

 				complex = Complex.Pow(complex \* complex \* complex - complex \* complex, 2.0) + c;

 				break;

 			case 50:

 				complex = Complex.Pow(complex \* complex - complex, 2.0) + c;

 				break;

 			case 51:

 				complex = (complex - Complex.Sqrt(complex)) \* (complex - Complex.Sqrt(complex)) + c;

 				break;

 			case 52:

 				complex = (complex \* complex + Complex.Sqrt(complex)) \* (complex \* complex + Complex.Sqrt(complex)) + c;

 				break;

 			case 53:

 				complex = complex \* complex \* Complex.Exp(complex) - complex \* Complex.Exp(complex) + c;

 				break;

 			case 54:

 				complex = (Complex.Exp(c \* complex) + c) \* (Complex.Exp(c \* complex) + c);

 				break;

 			case 55:

 				complex = Complex.Pow(complex, 5.0) + c \* Complex.Pow(complex, 3.0) + c;

 				break;

 			case 56:

 				complex = Complex.Exp(complex \* complex + c);

 				break;

 			case 57:

 				complex = Complex.Pow(complex, 8.0) + c;

 				break;

 			default:

 				Console.WriteLine("Error - no formula");

 				Debugger.Break();

 				break;

 			}

 		}

 		return i;

 	}

}

