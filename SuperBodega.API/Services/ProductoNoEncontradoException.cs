namespace SuperBodega.API.Services;

public class ProductoNoEncontradoException : Exception
{
    public ProductoNoEncontradoException(string message) : base(message)
    {
    }
}